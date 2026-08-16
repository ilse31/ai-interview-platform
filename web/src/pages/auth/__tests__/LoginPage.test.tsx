import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { createStore, Provider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/pages/auth/LoginPage";
import { authApi } from "@/services/auth";
import { authAtom } from "@/stores/authAtom";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/services/auth", () => ({
  authApi: { login: vi.fn() },
}));

function renderLoginPage() {
  const store = createStore();
  render(
    <Provider store={store}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </Provider>
  );
  return store;
}

describe("LoginPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    vi.mocked(authApi.login).mockReset();
  });

  it("logs in successfully: stores the token, updates auth state, and navigates to /assessments", async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce({
      data: { token: "issued-jwt-token" },
    } as never);
    const user = userEvent.setup();

    const store = renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "assessor@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/assessments"));

    expect(authApi.login).toHaveBeenCalledWith({
      email: "assessor@example.com",
      password: "correct-password",
    });
    expect(localStorage.getItem("auth_token")).toBe("issued-jwt-token");
    expect(store.get(authAtom).token).toBe("issued-jwt-token");
  });

  it("shows an inline error and does not navigate when the credentials are rejected", async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce({
      response: { status: 401, data: { errors: [{ message: "Invalid email or password" }] } },
    });
    const user = userEvent.setup();

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "assessor@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolveLogin!: (value: { data: { token: string } }) => void;
    vi.mocked(authApi.login).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }) as never
    );
    const user = userEvent.setup();

    renderLoginPage();

    await user.type(screen.getByLabelText(/email/i), "assessor@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();

    resolveLogin({ data: { token: "issued-jwt-token" } });
    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });
});
