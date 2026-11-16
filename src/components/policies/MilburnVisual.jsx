import { Coins, FileClock, FilePlus2, Footprints, GraduationCap, HandHeart, ShieldCheck } from "lucide-react";
import "./PolicyVisual.css";
import "./MilburnVisual.css";
import { milburnVisualView } from "../../utils/milburn/measureVisuals";

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
      <div className="mviz-groups" aria-hidden="true">
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
 * A Milburn measure's visual, or null where its spec does not hold. It
 * needs no policy_parameters.json entry: the rates are the spec's own.
 */
export function milburnVisual(policy) {
  const view = milburnVisualView(policy?.visual, policy?.label ?? policy?.name);
  if (!view) return null;
  return view.ages ? <AgeSteps view={view} /> : <Columns view={view} />;
}
