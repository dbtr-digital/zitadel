"use client";

// dbtr-Fork: kombinierte E-Mail+Passwort-Eingabe auf EINEM Screen.
// Ablauf: Mit Passwort authentifiziert sendPassword direkt in einem Request.
// Ohne Passwort routet sendLoginname wie die Original-Form weiter und erhält
// damit Passkey-/IdP-only- und Verify-Pfade.

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
import { Alert } from "./alert";
import { AutoSubmitForm } from "./auto-submit-form";
import { Button, ButtonSizes, ButtonVariants } from "./button";
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
  const [samlData, setSamlData] = useState<{ url: string; fields: Record<string, string> } | null>(null);

  const submitLoginNameOnly = useCallback(
    async (values: { loginName: string }, organization?: string) => {
      setLoading(true);
      try {
        const res = await sendLoginname({
          loginName: values.loginName.trim(),
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
      const normalizedLoginName = values.loginName.trim();

      // Ohne Passwort exakt das Original-Verhalten (zweischrittig) — nötig für
      // Passkey-/IdP-only-Konten und als Fallback.
      if (!values.password) {
        return submitLoginNameOnly({ loginName: normalizedLoginName }, organization);
      }

      setLoading(true);
      try {
        // sendPassword kann Suche, Session-Erstellung und Passwortprüfung selbst
        // ausführen. Der direkte Aufruf vermeidet einen zweiten Server-Roundtrip
        // und reduziert Timing-/Hydration-Probleme in Chromium-Browsern.
        const response = await sendPassword({
          loginName: normalizedLoginName,
          organization,
          defaultOrganization,
          requestId,
          checks: create(ChecksSchema, {
            password: { password: values.password },
          }),
        });

        handleServerActionResponse(response, router, setSamlData, setError);
      } catch {
        setError(t("errors.internalError"));
      } finally {
        setLoading(false);
      }
    },
    [defaultOrganization, requestId, organization, router, t, submitLoginNameOnly],
  );

  // "Passwort vergessen?" direkt vom Login-Screen: nimmt die bereits
  // eingetragene E-Mail mit — keine Doppeleingabe.
  async function resetPasswordAndContinue() {
    setError("");

    const currentLoginName = getValues("loginName").trim();
    if (!currentLoginName) {
      setError(t("required.loginName"));
      return;
    }

    setLoading(true);
    let response;
    try {
      response = await resetPassword({
        loginName: currentLoginName,
        organization,
        defaultOrganization,
        requestId,
      });
    } catch {
      setError(tPassword("errors.couldNotSendResetLink"));
      return;
    } finally {
      setLoading(false);
    }

    if (!response) {
      setError(tPassword("errors.couldNotSendResetLink"));
      return;
    }

    if ("error" in response && response.error) {
      setError(response.error as string);
      return;
    }

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
      <form className="w-full" onSubmit={handleSubmit(submitCombined)} noValidate>
        <div className="flex flex-col gap-4">
          <TextInput
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            {...register("loginName", {
              required: t("required.loginName"),
              validate: (value) => !!value.trim() || t("required.loginName"),
            })}
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

        {!loginSettings?.hidePasswordReset && (
          <div className="-mt-1 flex w-full justify-end">
            <button
              className="hover:text-primary-light-500 dark:hover:text-primary-dark-500 focus:ring-primary-light-500 dark:focus:ring-primary-dark-500 min-h-10 rounded px-1 text-sm transition-all focus:ring-2 focus:outline-none"
              onClick={resetPasswordAndContinue}
              type="button"
              disabled={loading}
              data-testid="reset-button"
            >
              <Translated i18nKey="verify.resetPassword" namespace="password" />
            </button>
          </div>
        )}

        {error && (
          <div className="py-4" data-testid="error">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-4 flex w-full flex-col gap-3">
          <Button
            data-testid="submit-button"
            type="submit"
            className="w-full justify-center"
            size={ButtonSizes.Large}
            variant={ButtonVariants.Primary}
            disabled={loading || !formState.isValid}
          >
            {loading && <Spinner className="mr-2 h-5 w-5" />}
            <Translated i18nKey="submit" namespace="loginname" />
          </Button>

          {allowRegister && (
            <Button
              className="w-full justify-center"
              size={ButtonSizes.Large}
              variant={ButtonVariants.Secondary}
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
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
