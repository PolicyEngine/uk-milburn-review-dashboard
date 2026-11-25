import { Package } from "lucide-react";

/**
 * The build's model and data, as the About drawer's "Built with" list
 * (OverviewDrawer) and the site footer say them. policyengine 6.20.3's
 * bundle certifies this Microcosm UK build with policyengine-uk 2.179.2
 * (uk_budget_data/local_build.py), so the line names all three.
 */
export const MICROCOSM_BUILD = "b891aa69";
export const POLICYENGINE_UK_VERSION = "2.179.2";
export const POLICYENGINE_VERSION = "6.20.3";

/** The one-line statement of what produced the figures. */
export const REPLICATION_LINE = `Microcosm UK build ${MICROCOSM_BUILD}, policyengine-uk ${POLICYENGINE_UK_VERSION}, certified in policyengine ${POLICYENGINE_VERSION}`;

/** The chip: the policyengine.py release, whose bundle pins the model and the data (on PyPI). */
export function replicationLinks() {
  return [
    {
      key: "bundle",
      label: `policyengine ${POLICYENGINE_VERSION}`,
      title: `policyengine ${POLICYENGINE_VERSION} on PyPI: its bundle certifies Microcosm UK build ${MICROCOSM_BUILD} with policyengine-uk ${POLICYENGINE_UK_VERSION}`,
      href: `https://pypi.org/project/policyengine/${POLICYENGINE_VERSION}/`,
      Icon: Package,
    },
  ];
}
