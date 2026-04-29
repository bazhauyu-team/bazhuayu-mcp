import { useTemplateWidgetPayload } from '../shared/bootstrap';

type TemplateCard = NonNullable<ReturnType<typeof useTemplateWidgetPayload>['cards']>[number];

function iconGlyph(iconKey: string | undefined): string {
  switch (iconKey) {
    case 'search-engine':
      return 'G';
    case 'maps':
      return 'M';
    case 'social-media':
      return 'S';
    case 'contact':
      return '@';
    default:
      return 'O';
  }
}

function priceTone(priceLabel: string | undefined): 'free' | 'paid' {
  if (!priceLabel) {
    return 'free';
  }

  return /no extra cost/i.test(priceLabel) ? 'free' : 'paid';
}

function supportsLocalRun(runOnLabel: string | undefined): boolean {
  const label = runOnLabel || '';
  return /local|本地/i.test(label);
}

function supportsCloudRun(runOnLabel: string | undefined, cloudFlag: boolean | undefined): boolean {
  const label = runOnLabel || '';
  return cloudFlag === true || /cloud|云/i.test(label);
}

function getTemplateGridClass(cards: TemplateCard[]): string {
  if (cards.length <= 3) {
    return 'template-grid--one-row';
  }

  if (cards.length <= 6) {
    return 'template-grid--two-row';
  }

  return 'template-grid--two-row-scroll';
}

export function SearchTemplatesApp() {
  const payload = useTemplateWidgetPayload();
  const cards = payload.cards ?? [];
  const recommended = payload.structuredContent?.recommendedTemplate;
  const total = payload.pagination?.total ?? cards.length;

  if (payload.isLoading) {
    return (
      <main className="widget-shell template-shell">
        <section className="template-list-header" aria-label="Template results summary">
          <div>
            <p className="eyebrow">bazhuayu Templates</p>
            <h1>Template Search Results</h1>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="widget-shell template-shell template-shell--simple">
      <section className="template-list-header" aria-label="Template results summary">
        <div>
          <p className="eyebrow">bazhuayu Templates</p>
          <h1>Template Search Results</h1>
        </div>
        <div className="result-count">
          <span>Total</span>
          <strong>{total}</strong>
        </div>
      </section>

      {recommended ? (
        <section className="template-inline-note" aria-label="Recommended template">
          <span className="chip chip-accent">Recommended</span>
          <strong>{recommended.displayName || recommended.templateName}</strong>
          <p>{recommended.reason || 'Best fit from the current search results.'}</p>
        </section>
      ) : null}

      <section
        className={`template-grid template-grid--simple ${getTemplateGridClass(cards)}`}
        aria-label="Template cards"
      >
        {cards.map((card) => (
          <article className="template-card template-card--simple" key={card.templateName || card.displayName}>
            <div className="template-card__header">
              <div className="template-icon">
                {card.imageUrl ? (
                  <img
                    className="template-card__image"
                    src={card.imageUrl}
                    alt={`${card.displayName || card.templateName || 'Template'} icon`}
                  />
                ) : (
                  iconGlyph(card.iconKey)
                )}
              </div>
              <div className="template-card__heading">
                <div className="template-card__title-row">
                  <h2>{card.displayName}</h2>
                  <div
                    className="template-run-icons"
                    aria-label={card.selectionMode === 'local_only' ? 'Local-only template' : `Run mode: ${card.runOnLabel || 'Unknown'}`}
                    title={card.runOnLabel || 'Unknown run mode'}
                  >
                    {supportsLocalRun(card.runOnLabel) ? (
                      <span className="template-run-icon template-run-icon--local" aria-label="Local run">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="4" y="5" width="16" height="11" rx="2" />
                          <path d="M9 20h6M12 16v4" />
                        </svg>
                      </span>
                    ) : null}
                    {supportsCloudRun(card.runOnLabel, card.supportsCloudScraping) ? (
                      <span className="template-run-icon template-run-icon--cloud" aria-label="Cloud run">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.35 8.4 4.8 4.8 0 0 0 7 18Z" />
                        </svg>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <p className="template-card__description">
              {card.shortDescription || 'Select this template to continue in the conversation.'}
            </p>

            <div className="template-card__footer">
              <strong className={`price price--${priceTone(card.priceLabel)}`}>
                {card.priceLabel || 'No Extra Cost'}
              </strong>
              <span className="template-meta template-meta--likes" aria-label={`${card.popularityLikes ?? 0} likes`}>
                ♡ {card.popularityLikes ?? 0}
              </span>
              <span className="template-meta">{card.lastModifiedLabel || 'Unknown date'}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
