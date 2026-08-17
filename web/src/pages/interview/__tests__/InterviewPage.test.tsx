import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPage from "@/pages/interview/InterviewPage";
import { sessionsApi } from "@/services/sessions";

// HardwareCheck does real browser media/audio work — irrelevant to the
// state-machine regressions under test (F12/F13), so it's stubbed out.
vi.mock("@/components/HardwareCheck", () => ({
  default: () => <div data-testid="hardware-check-stub" />,
}));

vi.mock("@/services/sessions", () => ({
  sessionsApi: { getCandidateInfo: vi.fn() },
}));

function renderInterviewPage(token = "some-token") {
  render(
    <MemoryRouter initialEntries={[`/interview/${token}`]}>
      <Routes>
        <Route path="/interview/:token" element={<InterviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InterviewPage — session status resolution (F12/F13 regression)", () => {
  beforeEach(() => {
    vi.mocked(sessionsApi.getCandidateInfo).mockReset();
  });

  it("F12: shows a loading state before the candidate-info fetch resolves, never flashing the hardware-check UI", () => {
    // Never-resolving promise — simulates the in-flight window before F12's fix.
    vi.mocked(sessionsApi.getCandidateInfo).mockReturnValue(new Promise(() => {}));

    renderInterviewPage();

    expect(screen.getByText(/loading interview/i)).toBeInTheDocument();
    expect(screen.queryByTestId("hardware-check-stub")).not.toBeInTheDocument();
    expect(screen.queryByText(/interview complete/i)).not.toBeInTheDocument();
  });

  it("F12: renders the hardware-check step only after the fetch resolves to a non-ended session", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: { session_id: 1, role_title: "Backend Engineer", time_limit_min: 30, session_status: "pending" },
    } as never);

    renderInterviewPage();

    expect(await screen.findByTestId("hardware-check-stub")).toBeInTheDocument();
    expect(screen.queryByText(/loading interview/i)).not.toBeInTheDocument();
  });

  it("F12: goes straight to 'Interview Complete' for an already-ended session, without ever rendering hardware-check", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockResolvedValue({
      data: { session_id: 1, role_title: "Backend Engineer", time_limit_min: 30, session_status: "ended" },
    } as never);

    renderInterviewPage();

    expect(await screen.findByText(/interview complete/i)).toBeInTheDocument();
    expect(screen.queryByTestId("hardware-check-stub")).not.toBeInTheDocument();
  });

  it("F13: shows an explicit invalid-link error (not 'Interview Complete') when the token 404s", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue({
      response: { status: 404, data: { error: "This interview link is invalid or has expired." } },
    });

    renderInterviewPage("bogus-token");

    expect(await screen.findByText(/unable to load interview/i)).toBeInTheDocument();
    expect(screen.getByText(/this interview link is invalid or has expired/i)).toBeInTheDocument();
    expect(screen.queryByText(/^interview complete$/i)).not.toBeInTheDocument();
  });

  it("F13: shows a generic error (not 'Interview Complete') for a non-404 failure", async () => {
    vi.mocked(sessionsApi.getCandidateInfo).mockRejectedValue({
      response: { status: 500, data: {} },
    });

    renderInterviewPage();

    expect(await screen.findByText(/unable to load interview/i)).toBeInTheDocument();
    expect(screen.getByText(/something went wrong loading this interview/i)).toBeInTheDocument();
    expect(screen.queryByText(/^interview complete$/i)).not.toBeInTheDocument();
  });
});
