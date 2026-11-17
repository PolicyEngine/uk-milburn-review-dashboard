
/**
 * The local build's label, near the figures of every view on the local
 * build route (utils/milburn/localBuild.js): the build and engine the runs
 * were made on, from their model_build.json, and that no certificate covers
 * it. Lists the runs not yet made, which show no figure. Nothing on the
 * verified route.
 */
export default function LocalBuildLabel() {
  // Nothing on the Impact pages (Vahid, 17 Nov): the build and versions are in
  // About and Methodology, and runs not yet made are listed on the Measures
  // tab ("Measures not yet run"), not as a banner over the figures
  return null;
}
