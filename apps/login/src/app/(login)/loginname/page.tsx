import { DynamicTheme } from "@/components/dynamic-theme";
import { SignInWithIdp } from "@/components/sign-in-with-idp";
import { Translated } from "@/components/translated";
import { UsernamePasswordForm } from "@/components/username-password-form";
import { getServiceConfig } from "@/lib/service-url";
import { getActiveIdentityProviders, getBrandingSettings, getDefaultOrg, getLoginSettings } from "@/lib/zitadel";
import { Organization } from "@zitadel/proto/zitadel/org/v2/org_pb";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("loginname");
  return { title: t("title") };
}

export default async function Page(props: { searchParams: Promise<Record<string | number | symbol, string | undefined>> }) {
  const searchParams = await props.searchParams;

  const loginName = searchParams?.loginName;
  const requestId = searchParams?.requestId;
  const organization = searchParams?.organization;
  const suffix = searchParams?.suffix;
  const submit: boolean = searchParams?.submit === "true";

  const _headers = await headers();
  const { serviceConfig } = getServiceConfig(_headers);

  let defaultOrganization;
  if (!organization) {
    const org: Organization | null = await getDefaultOrg({ serviceConfig });
    if (org) {
      defaultOrganization = org.id;
    }
  }

  const loginSettings = await getLoginSettings({ serviceConfig, organization: organization ?? defaultOrganization });

  const identityProviders = await getActiveIdentityProviders({
    serviceConfig,
    orgId: organization ?? defaultOrganization,
  }).then((resp) => {
    return resp.identityProviders;
  });

  const branding = await getBrandingSettings({ serviceConfig, organization: organization ?? defaultOrganization });

  return (
    <DynamicTheme branding={branding}>
      <div className="flex flex-col space-y-4">
        <h1>
          <Translated i18nKey="title" namespace="loginname" />
        </h1>
        <p className="ztdl-p">
          <Translated i18nKey="description" namespace="loginname" />
        </p>
      </div>

      <div className="w-full">
        {loginSettings?.allowLocalAuthentication && (
          <UsernamePasswordForm
            loginName={loginName}
            requestId={requestId}
            organization={organization} // stick to "organization" as we still want to do user discovery based on the searchParams not the default organization, later the organization is determined by the found user
            defaultOrganization={defaultOrganization}
            loginSettings={loginSettings}
            suffix={suffix}
            submit={submit}
            allowRegister={!!loginSettings?.allowRegister}
          ></UsernamePasswordForm>
        )}

        {/* dbtr-Fork: weitere Anmeldewege (IdPs) eingeklappt unter "Weitere Optionen";
            ohne lokale Anmeldung bleiben sie direkt sichtbar. */}
        {loginSettings?.allowExternalIdp &&
          !!identityProviders?.length &&
          (loginSettings?.allowLocalAuthentication ? (
            <details className="group w-full pt-4 pb-4">
              <summary className="hover:text-primary-light-500 dark:hover:text-primary-dark-500 flex cursor-pointer list-none items-center text-sm transition-all [&::-webkit-details-marker]:hidden">
                <Translated i18nKey="moreOptions" namespace="loginname" />
                <svg
                  className="ml-1 h-4 w-4 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="w-full pt-4">
                <SignInWithIdp
                  identityProviders={identityProviders}
                  requestId={requestId}
                  organization={organization}
                  postErrorRedirectUrl="/loginname"
                  showLabel={false}
                ></SignInWithIdp>
              </div>
            </details>
          ) : (
            <div className="w-full pt-6 pb-4">
              <SignInWithIdp
                identityProviders={identityProviders}
                requestId={requestId}
                organization={organization}
                postErrorRedirectUrl="/loginname"
                showLabel={false}
              ></SignInWithIdp>
            </div>
          ))}
      </div>
    </DynamicTheme>
  );
}
