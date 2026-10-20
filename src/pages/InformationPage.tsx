import type { Copy } from '../i18n/ru';
import type { ModelInfo } from '../types';
import { isKnownSbpModel } from '../config/indicator';

export function InformationPage({ route, copy, model }: { route: string; copy: Copy; model?: ModelInfo }) {
  const knownModel = isKnownSbpModel(model);
  const rows = knownModel ? copy.pages.sbpV2Rows : copy.pages.modelRows;
  const pages: Record<string, { title: string; body: string }> = {
    '/limitations': { title: copy.pages.limitations, body: knownModel ? `${copy.estimateAbout} ${copy.estimateDisclaimer}` : `${copy.aboutText} ${copy.disclaimer}.` },
    '/privacy': { title: copy.pages.privacy, body: copy.pages.privacyText },
    '/terms': { title: copy.pages.terms, body: copy.pages.termsText },
  };
  const page = pages[route] ?? { title: copy.pages.notFound, body: copy.pages.notFoundText };

  return route === '/model' ? <>
    <div className="page-intro"><h1>{copy.pages.model}</h1><p>{knownModel ? copy.estimateAbout : copy.pages.modelIntro}</p></div>
    <section className="panel"><dl className="model-details">
      {rows.map(([label, value], index) => <div key={label}><dt>{label}</dt>
        <dd>{!knownModel && index === 0 && model ? model.indicatorName : !knownModel && index === 3 && model?.modelVersion ? model.modelVersion : value}</dd></div>)}
    </dl><div className="actions"><a className="button button-primary" href="#/predict">{copy.pages.predict}</a>
      <a className="button button-secondary" href="#/limitations">{copy.pages.limitations}</a></div></section>
  </> : <section className="information-page"><h1>{page.title}</h1><p>{page.body}</p>
    <a className="button button-secondary" href="#/">{copy.pages.home}</a></section>;
}
