const path=require('path'), dotenv=require('dotenv');
dotenv.config({path:path.resolve(__dirname,'.env')});
dotenv.config({path:path.resolve(__dirname,'.env.secret')});
const {OpenAI}=require('openai');
const client=new OpenAI({apiKey:process.env.GLM_API_KEY, baseURL:process.env.GLM_API_URL||'https://api.z.ai/api/paas/v4'});
const bigPrompt='Tu es un directeur artistique. Conçois un logo vectoriel complet pour une fintech nommée "Nova Pay". Réfléchis en détail au concept, aux couleurs, à la typographie, à la symbolique, puis produis le SVG complet et détaillé (viewBox, paths, dégradés) accompagné d\'une explication. Sois exhaustif.';
async function run(label, extra){
  try{
    const r=await client.chat.completions.create(Object.assign({
      model:'glm-5.2',
      messages:[{role:'user',content:bigPrompt}],
      max_tokens:4000, temperature:0.5, top_p:0.95
    }, extra));
    const m=r.choices?.[0];
    console.log(`\n[${label}] finish=${m?.finish_reason} contentLen=${(m?.message?.content||'').length} reasoningLen=${(m?.message?.reasoning_content||'').length} usage=${JSON.stringify(r.usage)}`);
  }catch(e){ console.log(`\n[${label}] THROWN status=${e.status} msg=${(e.message||'').slice(0,120)}`); }
}
(async()=>{
  await run('A baseline max4000', {});
  await run('B thinking-disabled', { thinking:{type:'disabled'} });
  await run('C max12000', { max_tokens:12000 });
})();
