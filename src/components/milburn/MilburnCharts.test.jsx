import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MilburnChartCard } from "./MilburnCharts";
import { CHART_LOGO } from "../../utils/chartLogo";
import { downloadMenus, STANDARD_FORMATS } from "../../test/downloadMenus";

// jsdom measures nothing: the card's HTML is "drawn" as a fixed SVG, and the
// frame and the file are spied on
vi.mock("../../utils/exportDomAsSvg", () => ({
  domExportElements: (root) => [root],
  buildDomSvg: () => ({ svg: "<svg xmlns='http://www.w3.org/2000/svg'/>", width: 100, height: 50 }),
}));
vi.mock("../../utils/exportFrame", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, frameSvg: vi.fn(async (built) => built) };
});
vi.mock("../../utils/downloadFile", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadSvg: vi.fn(), downloadFile: vi.fn() };
});

afterEach(cleanup);

const card = (props) =>
  render(
    <MilburnChartCard icon="scale" title="A table card" name="a-table-card" csv={() => "a,b\r\n"} {...props}>
      <table>
        <tbody>
          <tr>
            <td>1</td>
          </tr>
        </tbody>
      </table>
    </MilburnChartCard>,
  );

describe("MilburnChartCard's logo", () => {
  it("is drawn under a plot by default", () => {
    const { container } = card();
    expect(container.querySelector(".chart-logo img")).toHaveAttribute("alt", "PolicyEngine");
  });

  it("is left off the page with logo={false}, the Download menu kept", () => {
    const { container } = card({ logo: false });
    expect(container.querySelector(".chart-logo")).toBeNull();
    expect(downloadMenus(container)).toEqual([{ name: "Download chart: A table card", formats: STANDARD_FORMATS }]);
  });

  it("is still in the downloaded image with logo={false}", async () => {
    const { frameSvg } = await import("../../utils/exportFrame");
    const { downloadSvg } = await import("../../utils/downloadFile");
    const { container } = card({ logo: false });
    fireEvent.click(container.querySelector(".chart-download-button"));
    fireEvent.click(container.querySelector('[data-format="svg"]'));
    await waitFor(() => expect(downloadSvg).toHaveBeenCalled());
    expect(frameSvg).toHaveBeenCalledWith(expect.anything(), expect.anything(), { logo: CHART_LOGO });
  });
});
