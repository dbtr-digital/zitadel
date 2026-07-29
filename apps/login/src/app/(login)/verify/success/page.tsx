import { DynamicTheme } from "@/components/dynamic-theme";
import { Translated } from "@/components/translated";
import { UserAvatar } from "@/components/user-avatar";
import { VerifySuccessContinue } from "@/components/verify-success-continue";
import { getServiceConfig } from "@/lib/service-url";
import { loadMostRecentSession } from "@/lib/session";
import { getBrandingSettings, getUserByID } from "@/lib/zitadel";
import { HumanUser, User } from "@zitadel/proto/zitadel/user/v2/user_pb";
import { headers } from "next/headers";

export default async function Page(props: { searchParams: Promise<any> }) {
  const searchParams = await props.searchParams;

  const _headers = await headers();
  const { serviceConfig } = getServiceConfig(_headers);

  const { loginName, organization, userId, requestId } = searchParams;
  const alreadyVerified = searchParams?.alreadyVerified === "true";

  const branding = await getBrandingSettings({ serviceConfig, organization });

  const sessionFactors = await loadMostRecentSession({ serviceConfig, sessionParams: { loginName, organization } });

  const id = userId ?? sessionFactors?.factors?.user?.id;

  if (!id) {
    throw Error("Failed to get user id");
  }

  const userResponse = await getUserByID({ serviceConfig, userId: id });

  let user: User | undefined;
  let human: HumanUser | undefined;

  if (userResponse) {
    user = userResponse.user;
    if (user?.type.case === "human") {
      human = user.type.value as HumanUser;
    }
  }

  // Build continue URL to re-enter the login flow with requestId preserved
  let continueUrl: string | undefined;
  if (requestId) {
    const params = new URLSearchParams();
    if (loginName || user?.preferredLoginName) {
      params.set("loginName", loginName ?? user?.preferredLoginName ?? "");
    }
    if (organization) {
      params.set("organization", organization);
    }
    params.set("requestId", requestId);
    continueUrl = `/loginname?${params}`;
  }

  const effectiveLoginName = loginName ?? user?.preferredLoginName;
  const loginUrl = effectiveLoginName
    ? `/loginname?${new URLSearchParams({ loginName: effectiveLoginName })}`
    : "/loginname";

  return (
    <DynamicTheme branding={branding}>
      <div className="flex flex-col space-y-4">
        <h1>
          <Translated i18nKey="successTitle" namespace="verify" />
        </h1>
        <p className="ztdl-p mb-6 block">
          <Translated
            i18nKey={alreadyVerified ? "alreadyVerifiedDescription" : "successDescription"}
            namespace="verify"
          />
        </p>

        {sessionFactors ? (
          <UserAvatar
            loginName={loginName ?? sessionFactors.factors?.user?.loginName}
            displayName={sessionFactors.factors?.user?.displayName}
            showDropdown
            searchParams={searchParams}
          ></UserAvatar>
        ) : (
          user && (
            <UserAvatar loginName={user.preferredLoginName} displayName={human?.profile?.displayName} showDropdown={false} />
          )
        )}
      </div>
      <div className="mt-8 flex w-full flex-wrap items-center justify-end gap-3">
        {continueUrl && <VerifySuccessContinue continueUrl={continueUrl} />}
        <a className="ztdl-button" href={loginUrl}>
          <Translated i18nKey="successLogin" namespace="verify" />
        </a>
        <a className="ztdl-button" href="https://app.atelier-master.com/#/onboarding">
          <Translated i18nKey="successAssistant" namespace="verify" />
        </a>
        <a className="ztdl-button" href="https://app.atelier-master.com/#/">
          <Translated i18nKey="successHome" namespace="verify" />
        </a>
      </div>
    </DynamicTheme>
  );
}
