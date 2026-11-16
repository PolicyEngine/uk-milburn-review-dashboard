import { Database, Package } from "lucide-react";

/**
 * The build's model and data, as the About drawer's "Built with" list
 * (OverviewDrawer) and the site footer say them. policyengine 6.20.1's
 * bundle certifies this Microcosm UK build with policyengine-uk 2.177.7
 * (uk_budget_data/local_build.py), so the line names all three.
 */
export const MICROCOSM_BUILD = "fcfac709";
export const POLICYENGINE_UK_VERSION = "2.177.7";
export const POLICYENGINE_VERSION = "6.20.1";

/** The one-line statement of what produced the figures. */
export const REPLICATION_LINE = `Microcosm UK build ${MICROCOSM_BUILD}, policyengine-uk ${POLICYENGINE_UK_VERSION}, certified in policyengine ${POLICYENGINE_VERSION}`;

/** The chips: the data build, the model package and the bundle that certifies them (on PyPI). */
export function replicationLinks() {
  return [
    {
      key: "data",
      label: `Microcosm UK build ${MICROCOSM_BUILD}`,
      title: `Microcosm UK 2024-25 build, certified in policyengine ${POLICYENGINE_VERSION}`,
      href: null,
      Icon: Database,
    },
    {
      key: "package",
      label: `policyengine-uk ${POLICYENGINE_UK_VERSION}`,
      title: `policyengine-uk ${POLICYENGINE_UK_VERSION} on PyPI`,
      href: `https://pypi.org/project/policyengine-uk/${POLICYENGINE_UK_VERSION}/`,
      Icon: Package,
    },
    {
      key: "bundle",
      label: `policyengine ${POLICYENGINE_VERSION}`,
      title: `policyengine ${POLICYENGINE_VERSION} on PyPI: its bundle certifies the build and the model together`,
      href: `https://pypi.org/project/policyengine/${POLICYENGINE_VERSION}/`,
      Icon: Package,
    },
  ];
}
