import { render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { RobotLoader } from "./robot-loader";

it("announces what is loading and shows a static robot when WebGL is unavailable (jsdom has none)", async () => {
  const { container } = render(<RobotLoader label="Loading drives" />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading drives…");
  await waitFor(() => expect(container.querySelector("svg")).not.toBeNull());
  expect(container.querySelector("canvas")).toBeNull();
});
