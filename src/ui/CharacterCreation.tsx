import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Game } from '../game.ts';
import { classes, hairColors, hairStyles, skinTones, suitColors } from '../character/character.ts';

export function CharacterCreation({ game }: { game: Game }) {
  const [step, setStep] = useState<'appearance' | 'class'>('appearance');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const screenRef = useRef<HTMLElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    screenRef.current?.scrollTo({ top: 0 });
  }, [step]);
  const character = useSyncExternalStore(game.character.subscribe, game.character.getSnapshot);
  const skin = skinTones.find((item) => item.id === character.skin)!.color;
  const hair = hairColors.find((item) => item.id === character.hair)!.color;
  const suit = suitColors.find((item) => item.id === character.suit)!.color;
  const selectedClass = classes.find((item) => item.id === character.classId)!;

  return (
    <main className="character-creation" ref={screenRef}>
      <header className="registration-header">
        <span className="brand">✧ STARBOUND</span>
        <span>KEPLER STATION / CREW REGISTRY</span>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!character.name.trim()) return;
          if (step === 'appearance') setStep('class');
          else game.character.confirm();
        }}
      >
        <div className="registration-title">
          <ol className="creation-steps" aria-label="Character creation progress">
            <li aria-current={step === 'appearance' ? 'step' : undefined}>01 Appearance</li>
            <li aria-current={step === 'class' ? 'step' : undefined}>02 Class</li>
          </ol>
          <h1 ref={headingRef} tabIndex={-1}>
            {step === 'appearance' ? 'Create your character.' : 'Choose your class.'}
          </h1>
        </div>
        {step === 'appearance' ? (
          <div className="character-layout">
            <section className="character-preview" aria-label="Character appearance preview">
              <svg
                viewBox="0 0 360 440"
                role="img"
                aria-label={`${character.name || 'Your character'}, ${selectedClass.name}, ${character.hairstyle} hair`}
              >
                <defs>
                  <radialGradient id="portrait-glow">
                    <stop stopColor={suit} stopOpacity=".22" />
                    <stop offset="1" stopColor={suit} stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx="180" cy="210" r="180" fill="url(#portrait-glow)" />
                <g fill="none" stroke={suit} opacity=".25">
                  <circle cx="180" cy="195" r="120" />
                  <path d="M30 195h300M180 40v330M80 395h200" />
                </g>
                <ellipse cx="180" cy="411" rx="102" ry="9" fill="#000" opacity=".3" />
                <path d="M132 302h96l-8 107h-34l-6-76-6 76h-34Z" fill="#29353c" />
                <path
                  d="m132 196-39 23-21 111 29 9 28-79 3 67h96l3-67 28 79 29-9-21-111-39-23Z"
                  fill={suit}
                />
                <path d="m132 196 48 25 48-25-15 102h-66Z" fill="#23363d" />
                {/* Longer hair sits behind the face and neck so the portrait keeps its depth. */}
                {character.hairstyle === 'long' && (
                  <path
                    d="M129 109q0-55 51-55t51 55l14 137-34-8-9-74h-44l-9 74-34 8Z"
                    fill={hair}
                  />
                )}
                {character.hairstyle === 'bob' && (
                  <path
                    d="M128 108q0-52 52-52t52 52l7 80q-24 14-41 4l-18-52-18 52q-17 10-41-4Z"
                    fill={hair}
                  />
                )}
                {character.hairstyle === 'bun' && <circle cx="180" cy="55" r="27" fill={hair} />}
                <path d="M160 166h40v43l-20 13-20-13Z" fill={skin} />
                <path d="m149 193 31 29-18 22-28-43m77-8-31 29 18 22 28-43" fill={suit} />
                <path d="M138 113q0-47 42-47t42 47v36q-5 43-42 45-37-2-42-45Z" fill={skin} />
                <path d="M138 127q-16-10-12 10t15 19m81-29q16-10 12 10t-15 19" fill={skin} />
                {character.hairstyle === 'crop' && (
                  <path
                    d="M135 126v-26q0-42 45-42t45 42v26l-12-23-4-17q-30 14-58 0l-4 23Z"
                    fill={hair}
                  />
                )}
                {character.hairstyle === 'swept' && (
                  <path
                    d="M134 136q-19-77 36-80 63-17 58 70l-15-23-5-23q-12 31-57 32l-9 24Z"
                    fill={hair}
                  />
                )}
                {character.hairstyle === 'shaved' && (
                  <path
                    d="M139 104q-1-40 41-40t41 40l-8-10q-33-22-66 0Z"
                    fill={hair}
                    opacity=".65"
                  />
                )}
                {character.hairstyle === 'bob' && (
                  <path
                    d="M131 123V99q0-43 49-43t49 43v24l-14-17-6-22v26h-58V84l-6 22Z"
                    fill={hair}
                  />
                )}
                {character.hairstyle === 'long' && (
                  <path
                    d="M131 139v-38q0-47 49-47t49 47v38l-14-28q-26-5-35-32-9 27-35 32Z"
                    fill={hair}
                  />
                )}
                {character.hairstyle === 'curls' && (
                  <path
                    d="M134 130q-21-5-16-24-13-15 1-29-2-19 19-22 6-21 27-14 15-17 30-2 22-8 29 13 23 0 24 22 17 13 4 30 5 21-20 26l-10-25q-13 8-23-3-13 11-25 0-13 11-26 1Z"
                    fill={hair}
                  />
                )}
                {character.hairstyle === 'bun' && (
                  <path
                    d="M135 125v-24q0-44 45-44t45 44v24l-12-22q-23-5-33-25-10 20-33 25Z"
                    fill={hair}
                  />
                )}
                {character.hairstyle === 'mohawk' && (
                  <path d="m165 98 1-46 10 5 5-22 8 20 10-7-2 50-16-9Z" fill={hair} />
                )}
                <g fill="#292b30">
                  <path d="m149 128 18-2v3l-18 2m44-5 18 2v3l-18-2" />
                  <ellipse cx="159" cy="138" rx="3" ry="3" />
                  <ellipse cx="201" cy="138" rx="3" ry="3" />
                </g>
                <path
                  d="m180 137-4 17h8m-17 13q13 7 26 0"
                  fill="none"
                  stroke="#754f43"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path d="M151 266h58v16h-58m-20 22h98v15h-98" fill="#101e29" />
                <path d="M179 229v70" stroke={suit} opacity=".65" />
                <rect x="194" y="242" width="16" height="8" rx="2" fill="#d7f1da" />
                <path d="m75 327 26 7-5 22-23-4m186-18 26-7 2 25-23 4" fill="#29353c" />
              </svg>
              <div className="portrait-caption">
                <strong>{character.name.trim() || 'Unregistered crew'}</strong>
              </div>
            </section>
            <section className="appearance-panel" aria-labelledby="appearance-title">
              <h2 id="appearance-title">Appearance</h2>
              <label className="name-label" htmlFor="character-name">
                CHARACTER NAME
              </label>
              <input
                id="character-name"
                required
                maxLength={24}
                value={character.name}
                placeholder="Enter your name"
                autoComplete="off"
                onChange={(event) => game.character.setName(event.target.value)}
              />
              {(
                [
                  { key: 'skin', label: 'Skin tone', values: skinTones },
                  { key: 'hair', label: 'Hair color', values: hairColors },
                  { key: 'suit', label: 'Suit color', values: suitColors },
                ] as const
              ).map(({ key, label, values }) => (
                <fieldset key={key}>
                  <legend>{label}</legend>
                  <div className="character-swatches">
                    {values.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        title={item.name}
                        aria-label={`${label}: ${item.name}`}
                        aria-pressed={character[key] === item.id}
                        style={{ background: item.color }}
                        onClick={() => game.character.choose(key, item.id)}
                      >
                        {character[key] === item.id ? '✓' : ''}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
              <fieldset>
                <legend>Hair style</legend>
                <div className="hair-options">
                  {hairStyles.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={character.hairstyle === item.id}
                      onClick={() => game.character.choose('hairstyle', item.id)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </fieldset>
            </section>
          </div>
        ) : (
          <div className="class-layout">
            <section className="class-panel" aria-label="Class selection">
              <div className="class-options" role="group" aria-label="Character class">
                {classes.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="class-option"
                    aria-pressed={character.classId === item.id}
                    onClick={() => game.character.choose('classId', item.id)}
                  >
                    <span className="class-symbol" aria-hidden="true">
                      {item.symbol}
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                    </span>
                    <span className="class-check" aria-hidden="true">
                      {character.classId === item.id ? '✓' : '○'}
                    </span>
                  </button>
                ))}
              </div>
              <div className="class-description" aria-live="polite">
                <p>{selectedClass.description}</p>
                <span>{selectedClass.specialty}</span>
              </div>
            </section>
            <section className="class-stats" aria-labelledby="stats-title">
              <h2 id="stats-title">Stat bonuses</h2>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Stat</th>
                    {classes.map((item) => (
                      <th
                        scope="col"
                        key={item.id}
                        className={item.id === character.classId ? 'selected-stat' : ''}
                      >
                        {item.name}
                        {item.id === character.classId && <span aria-label="selected"> ✓</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      { id: 'scanning', label: 'Scanner range' },
                      { id: 'salvage', label: 'Salvage yield' },
                      { id: 'health', label: 'Maximum health' },
                    ] as const
                  ).map((stat) => (
                    <tr key={stat.id}>
                      <th scope="row">{stat.label}</th>
                      {classes.map((item) => (
                        <td
                          key={item.id}
                          className={item.id === character.classId ? 'selected-stat' : ''}
                        >
                          {item.bonuses[stat.id] ? `+${item.bonuses[stat.id]}%` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="field-hint">
                Proposed bonuses; not active in gameplay yet. — means no bonus.
              </p>
            </section>
          </div>
        )}
        <footer className="registration-footer">
          {step === 'class' && (
            <button type="button" className="back-button" onClick={() => setStep('appearance')}>
              ← APPEARANCE
            </button>
          )}
          <div className="registration-submit">
            <button className="primary-button" disabled={!character.name.trim()} type="submit">
              {step === 'appearance' ? 'NEXT: CLASS' : 'CONFIRM CHARACTER'} <span>→</span>
            </button>
          </div>
        </footer>
      </form>
    </main>
  );
}
