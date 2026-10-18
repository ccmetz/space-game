import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { CharacterPreview } from './CharacterPreview.tsx';
import type { Game } from '../game.ts';
import { classes, hairColors, hairStyles, skinTones, suitColors } from '../character/character.ts';

export function CharacterCreation({
  game,
  themeSelector,
}: {
  game: Game;
  themeSelector: ReactNode;
}) {
  const [step, setStep] = useState<'appearance' | 'class'>('appearance');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const screenRef = useRef<HTMLElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    screenRef.current?.scrollTo({ top: 0 });
  }, [step]);
  const character = useSyncExternalStore(game.character.subscribe, game.character.getSnapshot);

  const selectedClass = classes.find((item) => item.id === character.classId)!;

  return (
    <main className="character-creation" ref={screenRef}>
      <header className="registration-header">
        <span className="brand">✧ STARBOUND</span>
        <span className="registry-location">KEPLER STATION / CREW REGISTRY</span>
        {themeSelector}
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
              <CharacterPreview appearance={character} name={character.name} />
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
