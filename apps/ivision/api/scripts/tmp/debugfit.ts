import { loadSecrets } from '../../src/config/secrets';
(async () => {
  await loadSecrets();
  process.env.RENDER_ALLOWED_HOSTS = 'localhost,127.0.0.1';
  const { TEMPLATE_BY_ID } = await import('../../../core/src/visual/poster/poster.templates');
  const { posterDocument, posterFonts } = await import('../../../core/src/visual/poster/poster.render');
  const { specFor } = await import('../../../core/src/visual/poster/poster.spec');
  const { flyerRenderService } = await import('../../../core/src/visual/flyer.render');
  const copy = { kicker: 'DevGirls Live', headline: 'La tech au féminin prend le micro', sub: 'Scène ouverte, témoignages et rencontres pour celles qui codent et construisent.', facts: [{ kind: 'date', text: 'Samedi 12 oct.' }, { kind: 'time', text: '18h00' }, { kind: 'place', text: 'La Scène · Paris 11e' }, { kind: 'other', text: 'Entrée libre' }], emphasis: 3 };
  const t = TEMPLATE_BY_ID.get(process.argv[2] || 'split')!;
  const spec = specFor({ format: (process.argv[3] || 'story') as any, copy: copy as any, palette: { primary: '#f00e93', secondary: '#1a1a1a', accent: '#00d31b', background: '#ffffff', text: '#1a1a1a' }, image: { url: 'http://localhost:9000/idem-storage/ivision/users/5DjQ1ou89dfIoOIBYsOA6BFCsMa2/brands/brand_mv0osyv845218a7b-photo-2.png', focal: { x: 0.6, y: 0.4 }, aspect: 1.5, origin: 'brand' }, logo: { ink: 'dark', luminance: 0.1, aspect: 2.3 }, brandName: 'DevGirls', language: 'fr' }, { template: t.id, scheme: 'paper', mirror: false, treatment: 'natural' })!;
  const fonts = posterFonts({ primaryFont: 'Noto Sans', secondaryFont: 'Noto Sans' });
  const doc = posterDocument(spec, t.render(spec), fonts);
  await flyerRenderService.withPage(spec.width, spec.height, async (page) => {
    await page.setContent(doc, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 1500));
    const info = await page.evaluate(`(function(){var st=document.querySelector('[data-stack]');var out={stack:[st.clientWidth,st.clientHeight,st.scrollHeight]};var k=1;var els=st.querySelectorAll('.fit');for(var j=0;j<els.length;j++){var e=els[j];e.style.fontSize=e.getAttribute('data-max')+'px';}out.els=Array.prototype.map.call(els,function(e){return [e.className,e.style.fontSize,e.clientWidth,e.scrollWidth,e.clientHeight]});out.after=st.scrollHeight;return out;})()`);
    console.log(JSON.stringify(info));
  });
  process.exit(0);
})();
