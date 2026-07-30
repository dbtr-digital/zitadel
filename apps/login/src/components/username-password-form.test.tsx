import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UsernamePasswordForm } from "./username-password-form";

const mocks = vi.hoisted(() => ({
  handleResponse: vi.fn(),
  push: vi.fn(),
  resetPassword: vi.fn(),
  sendLoginname: vi.fn(),
  sendPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/client-utils", () => ({
  handleServerActionResponse: mocks.handleResponse,
}));

vi.mock("@/lib/server/loginname", () => ({
  sendLoginname: mocks.sendLoginname,
}));

vi.mock("@/lib/server/password", () => ({
  resetPassword: mocks.resetPassword,
  sendPassword: mocks.sendPassword,
}));

function renderForm() {
  return render(
    <UsernamePasswordForm loginName="" requestId="request-1" loginSettings={undefined} submit={false} allowRegister />,
  );
}

describe("UsernamePasswordForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("authenticates directly with a normalized login name", async () => {
    mocks.sendPassword.mockResolvedValue({ redirect: "/done" });
    const { getByTestId } = renderForm();

    fireEvent.change(getByTestId("username-text-input"), { target: { value: "  test@example.com  " } });
    fireEvent.change(getByTestId("password-text-input"), { target: { value: "secret" } });
    fireEvent.submit(getByTestId("submit-button").closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(mocks.sendPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          loginName: "test@example.com",
          requestId: "request-1",
        }),
      );
    });
    expect(mocks.sendLoginname).not.toHaveBeenCalled();
  });

  test("does not open the reset screen when the reset request fails", async () => {
    mocks.resetPassword.mockRejectedValue(new Error("network"));
    const { getByTestId, getByText } = renderForm();

    fireEvent.change(getByTestId("username-text-input"), { target: { value: "test@example.com" } });
    fireEvent.click(getByTestId("reset-button"));

    await waitFor(() => {
      expect(getByText("errors.couldNotSendResetLink")).toBeTruthy();
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
