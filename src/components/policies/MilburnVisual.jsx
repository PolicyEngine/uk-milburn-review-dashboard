import { ArrowRightLeft, Coins, FileClock, FilePlus2, Footprints, GraduationCap, HandHeart, ShieldCheck } from "lucide-react";
import TitleIcon from "../TitleIcon";
import "./PolicyVisual.css";
import "./MilburnVisual.css";
import { milburnVisualView, phasedSavingShares, phasedView } from "../../utils/milburn/measureVisuals";
import { useMilburnSummary } from "../../utils/milburn/summary";

/*
 * The Milburn measures' card visuals, in two shapes: an amount by age (a
 * cell an age, current law's outline behind the measure's bar) and
 * columns from a shared baseline (current law beside the measure, or a
 * year each). The numbers and the text alternative come from
 * utils/milburn/measureVisuals.js. Each is one image (role="img", its
 * aria-label saying the figures), HTML in the dashboard's tokens, still.
 */

const AGE_HEIGHT = 54;
const COLUMN_HEIGHT = 72;

const Key = ({ items }) => (
  <p className="mviz-key" aria-hidden="true">
    {items.map(([swatch, words]) => (
      <span key={words} className={`mviz-key-item is-${swatch}`}>
        {words}
      </span>
    ))}
  </p>
);

/** A chip's icon, by name (measureVisuals.js). */
const CHIP_ICONS = {
  "file-clock": FileClock,
  "file-plus": FilePlus2,
  shield: ShieldCheck,
  hand: HandHeart,
  move: Footprints,
  coins: Coins,
  cap: GraduationCap,
};

const ChipIcon = ({ name }) => {
  const Icon = Object.hasOwn(CHIP_ICONS, name ?? "") ? CHIP_ICONS[name] : null;
  return Icon ? <Icon size={13} className="mviz-chip-icon" /> : null;
};

const Chips = ({ chips }) =>
  chips?.length > 0 && (
    <span className="mviz-chips" aria-hidden="true">
      {chips.map((chip) => (
        <span className="mviz-chip" key={chip.when}>
          <span className="mviz-chip-when">
            <ChipIcon name={chip.icon} />
            {chip.when}
          </span>
          <span className="mviz-chip-value">{chip.value}</span>
        </span>
      ))}
    </span>
  );

const Head = ({ view }) => (
  <div className="pviz-head" aria-hidden="true">
    <p className="pviz-caption">{view.caption}</p>
    <Key items={view.key} />
  </div>
);

/** An amount by age: a cell an age, then the age bands with what each gets. */
function AgeSteps({ view }) {
  const first = view.ages[0].age;
  const columns = { gridTemplateColumns: `repeat(${view.ages.length}, minmax(0, 1fr))` };
  return (
    <div className="pviz mviz mviz-steps" role="img" aria-label={view.alt}>
      <Head view={view} />
      <div className="mviz-ages" style={columns} aria-hidden="true">
        {view.ages.map((cell) => (
          <span className="mviz-age" key={cell.age} style={{ height: `${AGE_HEIGHT}px` }}>
            {cell.before > cell.after && <span className="mviz-age-ghost" style={{ height: `${Math.round(AGE_HEIGHT * cell.before)}px` }} />}
            <span
              className={`mviz-age-bar${cell.some ? " is-some" : ""}${cell.after === 0 ? " is-nil" : ""}`}
              style={{ height: `${Math.max(2, Math.round(AGE_HEIGHT * cell.after))}px` }}
            />
          </span>
        ))}
        {view.ages.map((cell) => (
          <span className="mviz-age-tick" key={cell.age}>
            {cell.label}
          </span>
        ))}
        {view.bands.map((band) => (
          <span
            className={`mviz-band is-${band.tone}`}
            key={band.title}
            style={{ gridColumn: `${band.from - first + 1} / span ${band.to - band.from + 1}` }}
          >
            <span className="mviz-band-title">{band.title}</span>
            <span className="mviz-band-text">{band.text}</span>
          </span>
        ))}
      </div>
      <Chips chips={view.chips} />
    </div>
  );
}

const height = (value, max) => `${Math.round((COLUMN_HEIGHT * value) / max)}px`;

/** Columns from a shared baseline, in groups: a column's parts stacked, its value on top. */
function Columns({ view }) {
  return (
    <div className="pviz mviz mviz-cols" role="img" aria-label={view.alt}>
      <Head view={view} />
      {/* No columns: the view is its chips alone (the phased rule without the summary) */}
      <div className="mviz-groups" aria-hidden="true" hidden={view.groups.length === 0}>
        {view.groups.map((group, index) => (
          <div className="mviz-group" key={group.label ?? group.columns[0].label ?? index}>
            <div className="mviz-columns">
              {group.columns.map((column) => (
                <div className="mviz-column" key={column.label}>
                  <span className="mviz-column-area" style={{ height: `${COLUMN_HEIGHT + 20}px` }}>
                    <span className="mviz-column-value">{column.text}</span>
                    <span className="mviz-column-stack" style={column.ghost ? { height: height(column.ghost, view.max) } : undefined}>
                      {column.ghost && <span className="mviz-column-ghost" />}
                      {column.parts.map((part) => (
                        <span key={part.tone} className={`mviz-column-part is-${part.tone}`} style={{ height: height(part.value, view.max) }} />
                      ))}
                    </span>
                  </span>
                  <span className="mviz-column-label">{column.label}</span>
                </div>
              ))}
            </div>
            {group.label && <span className="mviz-group-label">{group.label}</span>}
            {group.note && <span className={`mviz-group-note is-${group.tone ?? "gain"}`}>{group.note}</span>}
          </div>
        ))}
      </div>
      <Chips chips={view.chips} />
    </div>
  );
}

/**
 * The phased package: its rule, and its saving as a share of full
 * abolition's in each year, read from milburn_summary.json. The rule alone
 * while the file is loading or missing.
 */
function PhasedColumns({ policy }) {
  const { summary } = useMilburnSummary(null);
  const view = phasedView(policy.visual, policy.label ?? policy.name, phasedSavingShares(summary, policy.id));
  return <Columns view={view} />;
}

/**
 * A Milburn measure's visual, or null where its spec does not hold. It
 * needs no policy_parameters.json entry: the rates are the spec's own.
 */
export function milburnVisual(policy) {
  if (policy?.visual?.kind === "milburn-phased") return <PhasedColumns policy={policy} />;
  const view = milburnVisualView(policy?.visual, policy?.label ?? policy?.name);
  if (!view) return null;
  return view.ages ? <AgeSteps view={view} /> : <Columns view={view} />;
}

/*
 * The measures we cannot compute (utils/milburn/notComputable.js): a
 * diagram each, never a figure. Three shapes: a decision split (a test,
 * then what follows where it is met and where it is not), a swap of one
 * benefit for another whose rules are unknown, and offers with more
 * places. Icons are TitleIcon's; what is unknown or not modelled is
 * dashed. Each is one image, named by its `alt` sentence.
 */

const Glyph = ({ name, size = 16 }) => <TitleIcon bare name={name} size={size} className="mnc-glyph" />;

const Arrow = () => <TitleIcon bare name="arrowRight" size={14} className="mnc-arrow" />;

/** A step of a diagram: its icon in a chip, then its one-line label. */
const Node = ({ node, tile = false }) => (
  <span className={`mnc-node is-${node.tone ?? "before"}${tile ? " is-tile" : ""}${node.unknown ? " is-unknown" : ""}`}>
    <span className="mnc-icon">
      <Glyph name={node.icon} />
      {node.plus && <TitleIcon bare name="plus" size={9} className="mnc-icon-plus" />}
    </span>
    <span className="mnc-label">{node.label}</span>
    {node.unknown && (
      <span className="mnc-chip is-unknown">
        <Glyph name="help" size={12} />
        {node.unknown}
      </span>
    )}
  </span>
);

/** A claimant, a test, then a branch each way: met and not met. */
function Split({ spec }) {
  return (
    <div className="mnc-split">
      <div className="mnc-trunk">
        {/* The test in the middle, so the fork's stem leaves from it */}
        <span className="mnc-trunk-root">
          {spec.root.map((node) => (
            <span className="mnc-trunk-step" key={node.label}>
              <Node node={node} />
              <Arrow />
            </span>
          ))}
        </span>
        <Node node={spec.test} />
      </div>
      <span className="mnc-fork" />
      <div className="mnc-branches">
        {spec.branches.map((branch) => (
          <div className={`mnc-branch is-${branch.tone ?? "before"}`} key={branch.answer}>
            <span className="mnc-answer">{branch.answer}</span>
            <Node node={branch} tile />
          </div>
        ))}
      </div>
      {spec.marker && (
        <p className="mnc-marker">
          <Glyph name="ban" size={12} />
          {spec.marker}
        </p>
      )}
    </div>
  );
}

/** One side of a swap: when, the benefit, and its rules as chips (known ticked, unknown dashed). */
const SwapCard = ({ side, tone }) => (
  <div className={`mnc-card is-${tone}${side.unknowns ? " is-unknown" : ""}`}>
    <span className="mnc-when">{side.when}</span>
    <span className="mnc-card-name">
      <span className="mnc-icon">
        <Glyph name={side.icon} />
      </span>
      <span className="mnc-label">{side.label}</span>
    </span>
    <span className="mnc-chips">
      {(side.facts ?? []).map((fact) => (
        <span className="mnc-chip" key={fact}>
          <Glyph name="check" size={12} />
          {fact}
        </span>
      ))}
      {(side.unknowns ?? []).map((unknown) => (
        <span className="mnc-chip is-unknown" key={unknown}>
          <Glyph name="help" size={12} />
          {unknown}
        </span>
      ))}
    </span>
  </div>
);

/** Today's benefit, an arrow, the proposed one in its place. */
function Swap({ spec }) {
  return (
    <div className="mnc-swap">
      <SwapCard side={spec.before} tone="before" />
      <Arrow />
      <SwapCard side={spec.after} tone="gain" />
    </div>
  );
}

/** What is offered, a tile each, over the places: today's, then more. */
function Offers({ spec }) {
  return (
    <div className="mnc-offers">
      <div className="mnc-tiles">
        {spec.offers.map((offer) => (
          <Node node={{ ...offer, tone: "gain", plus: true }} tile key={offer.label} />
        ))}
      </div>
      <div className="mnc-places">
        <span className="mnc-places-today">{spec.today}</span>
        <span className="mnc-places-more">
          <Glyph name="plus" size={12} />
          {spec.more}
        </span>
      </div>
      <p className="mnc-scale">{spec.scale}</p>
    </div>
  );
}

const NOT_COMPUTABLE_KINDS = { split: Split, swap: Swap, offers: Offers };

/**
 * A not-computable measure's diagram under "What changes", or nothing
 * where it has none of a known kind.
 */
export function NotComputableVisual({ measure }) {
  const spec = measure?.visual;
  const Diagram = Object.hasOwn(NOT_COMPUTABLE_KINDS, spec?.kind ?? "") ? NOT_COMPUTABLE_KINDS[spec.kind] : null;
  if (!Diagram) return null;
  return (
    <section className="pchg mnc-section" aria-label={`What changes: ${measure.name}`}>
      <div className="pchg-head">
        <p className="pchg-title">
          <ArrowRightLeft size={14} aria-hidden="true" />
          What changes
        </p>
      </div>
      <figure className={`pviz mnc is-kind-${spec.kind}`} role="img" aria-label={spec.alt} data-kind={spec.kind}>
        <figcaption className="pviz-caption" aria-hidden="true">
          {spec.caption}
        </figcaption>
        <div className="mnc-body" aria-hidden="true">
          <Diagram spec={spec} />
        </div>
      </figure>
    </section>
  );
}

export { NOT_COMPUTABLE_KINDS };
