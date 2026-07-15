"use client";

// dbtr-Fork: kombinierte E-Mail+Passwort-Eingabe auf EINEM Screen.
// Ablauf: sendLoginname routet wie gehabt (Passkey/IdP/Verify bleiben erhalten);
// zeigt das Routing auf /password und ist ein Passwort eingegeben, wird der
// Passwort-Check direkt ausgeführt (sendPassword kann User-Suche + Passwort-Check
// in einem Schritt, auch ohne vorherige Session). Leeres Passwort = Verhalten
// der Original-UsernameForm (zweischrittig) — deckt Passkey-/IdP-only-Nutzer ab.

import { handleServerActionResponse } from "@/lib/client-utils";
import { sendLoginname } from "@/lib/server/loginname";
import { resetPassword, sendPassword } from "@/lib/server/password";
import { create } from "@zitadel/client";
import { ChecksSchema } from "@zitadel/proto/zitadel/session/v2/session_service_pb";
import { LoginSettings } from "@zitadel/proto/zitadel/settings/v2/login_settings_pb";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, AlertType } from "./alert";
import { AutoSubmitForm } from "./auto-submit-form";
import { Button, ButtonVariants } from "./button";
import { TextInput } from "./input";
import { Spinner } from "./spinner";
import { Translated } from "./translated";

type Inputs = {
  loginName: string;
  password: string;
};

type Props = {
  loginName: string | undefined;
  requestId: string | undefined;
  loginSettings: LoginSettings | undefined;
  organization?: string;
  defaultOrganization?: string;
  suffix?: string;
  hideSuffix?: boolean;
  submit: boolean;
  allowRegister: boolean;
};

export function UsernamePasswordForm({
  loginName,
  requestId,
  organization,
  defaultOrganization,
  suffix,
  hideSuffix,
  loginSettings,
  submit,
  allowRegister,
}: Props) {
  const { register, handleSubmit, formState, getValues } = useForm<Inputs>({
    mode: "onChange",
    defaultValues: {
      loginName: loginName ? loginName : "",
      password: "",
    },
  });

  const t = useTranslations("loginname");
  const tPassword = useTranslations("password");

  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [info, setInfo] = useState<string>("");
  const [samlData, setSamlData] = useState<{ url: string; fields: Record<string, string> } | null>(null);

  const submitLoginNameOnly = useCallback(
    async (values: { loginName: string }, organization?: string) => {
      setLoading(true);
      try {
        const res = await sendLoginname({
          loginName: values.loginName,
          organization,
          defaultOrganization,
          requestId,
          suffix,
          ignoreUnknownUsernames: loginSettings?.ignoreUnknownUsernames,
        });

        handleServerActionResponse(res, router, setSamlData, setError);
        return res;
      } catch {
        setError(t("errors.internalError"));
      } finally {
        setLoading(false);
      }
    },
    [defaultOrganization, requestId, suffix, loginSettings, router, t],
  );

  const submitCombined = useCallback(
    async (values: Inputs) => {
      setError("");
      setInfo("");

      // Ohne Passwort exakt das Original-Verhalten (zweischrittig) — nötig für
      // Passkey-/IdP-only-Konten und als Fallback.
      if (!values.password) {
        return submitLoginNameOnly({ loginName: values.loginName }, organization);
      }

      setLoading(true);
      try {
        const res = await sendLoginname({
          loginName: values.loginName,
          organization,
          defaultOrganization,
          requestId,
          suffix,
          ignoreUnknownUsernames: loginSettings?.ignoreUnknownUsernames,
        });

        if (res && "redirect" in res && res.redirect && res.redirect.startsWith("/password?")) {
          // Passwort-Nutzer (oder Enumeration-Schutz-Pfad): Check direkt hier,
          // mit den von sendLoginname aufgelösten Parametern (loginName/organization).
          const params = new URLSearchParams(res.redirect.substring(res.redirect.indexOf("?") + 1));
          const response = await sendPassword({
            loginName: params.get("loginName") ?? values.loginName,
            organization: params.get("organization") ?? organization,
            defaultOrganization,
            requestId: params.get("requestId") ?? requestId,
            checks: create(ChecksSchema, {
              password: { password: values.password },
            }),
          });

          handleServerActionResponse(response, router, setSamlData, setError);
          return;
        }

        // Alle anderen Wege (Passkey, IdP, Verify, Fehler) regulär behandeln.
        handleServerActionResponse(res, router, setSamlData, setError);
      } catch {
        setError(t("errors.internalError"));
      } finally {
        setLoading(false);
      }
    },
    [defaultOrganization, requestId, suffix, loginSettings, organization, router, t, submitLoginNameOnly],
  );

  // "Passwort vergessen?" direkt vom Login-Screen: nimmt die bereits
  // eingetragene E-Mail mit — keine Doppeleingabe.
  async function resetPasswordAndContinue() {
    setError("");
    setInfo("");

    const currentLoginName = getValues("loginName");
    if (!currentLoginName) {
      setError(t("required.loginName"));
      return;
    }

    setLoading(true);
    const response = await resetPassword({
      loginName: currentLoginName,
      organization,
      defaultOrganization,
      requestId,
    })
      .catch(() => {
        setError(tPassword("errors.couldNotSendResetLink"));
        return;
      })
      .finally(() => {
        setLoading(false);
      });

    if (response && "error" in response && response.error) {
      setError(response.error as string);
      return;
    }

    setInfo(tPassword("verify.info.passwordResetSent"));

    const params = new URLSearchParams({
      loginName: currentLoginName,
    });

    if (organization) {
      params.append("organization", organization);
    }

    if (requestId) {
      params.append("requestId", requestId);
    }

    return router.push("/password/set?" + params);
  }

  useEffect(() => {
    if (submit && loginName) {
      // Deep-Link-Verhalten der Original-Form beibehalten (submit=true → direkt routen).
      submitLoginNameOnly({ loginName }, organization);
    }
  }, [submit, loginName, organization, submitLoginNameOnly]);

  let inputLabel = t("labels.loginname");
  if (loginSettings?.disableLoginWithEmail && loginSettings?.disableLoginWithPhone) {
    inputLabel = t("labels.username");
  } else if (loginSettings?.disableLoginWithEmail) {
    inputLabel = t("labels.usernameOrPhoneNumber");
  } else if (loginSettings?.disableLoginWithPhone) {
    inputLabel = t("labels.usernameOrEmail");
  }

  return (
    <>
      {samlData && <AutoSubmitForm url={samlData.url} fields={samlData.fields} />}
      <form className="w-full">
        <div className="flex flex-col gap-4">
          <TextInput
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            {...register("loginName", { required: t("required.loginName") })}
            label={inputLabel}
            data-testid="username-text-input"
            suffix={hideSuffix ? undefined : suffix}
          />
          <div className={`${error && "animate-shake transform-gpu"}`}>
            <TextInput
              type="password"
              autoComplete="current-password"
              {...register("password")}
              label={tPassword("verify.labels.password")}
              data-testid="password-text-input"
            />
          </div>
        </div>

        <div className="flex w-full flex-row items-center justify-between">
          {allowRegister ? (
            <button
              className="hover:text-primary-light-500 dark:hover:text-primary-dark-500 text-sm transition-all"
              onClick={() => {
                const registerParams = new URLSearchParams();
                if (organization) {
                  registerParams.append("organization", organization);
                }
                if (requestId) {
                  registerParams.append("requestId", requestId);
                }

                router.push("/register?" + registerParams);
              }}
              type="button"
              disabled={loading}
              data-testid="register-button"
            >
              <Translated i18nKey="register" namespace="loginname" />
            </button>
          ) : (
            <span></span>
          )}
          {!loginSettings?.hidePasswordReset && (
            <button
              className="hover:text-primary-light-500 dark:hover:text-primary-dark-500 text-sm transition-all"
              onClick={() => resetPasswordAndContinue()}
              type="button"
              disabled={loading}
              data-testid="reset-button"
            >
              <Translated i18nKey="verify.resetPassword" namespace="password" />
            </button>
          )}
        </div>

        {info && (
          <div className="py-4">
            <Alert type={AlertType.INFO}>{info}</Alert>
          </div>
        )}

        {error && (
          <div className="py-4" data-testid="error">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-4 flex w-full flex-row items-center">
          <span className="flex-grow"></span>
          <Button
            data-testid="submit-button"
            type="submit"
            className="self-end"
            variant={ButtonVariants.Primary}
            disabled={loading || !formState.isValid}
            onClick={handleSubmit((e) => submitCombined(e))}
          >
            {loading && <Spinner className="mr-2 h-5 w-5" />}
            <Translated i18nKey="submit" namespace="loginname" />
          </Button>
        </div>
      </form>
    </>
  );
}
