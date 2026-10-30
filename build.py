#!/usr/bin/env python3
"""Build a single-file Vocab Quest page.
usage: build.py --id foundation --cls "IELTS Foundation" --week 1=Week1.tsv --week 2=Week2.tsv --out out.html [--per-day 20] [--no-date-lock] [--wrap]
"""
import argparse, base64, json, pathlib
ap=argparse.ArgumentParser()
ap.add_argument('--id',required=True); ap.add_argument('--cls',required=True); ap.add_argument('--title',default='Vocab Quest')
ap.add_argument('--week',action='append',required=True,help='N=path.tsv'); ap.add_argument('--per-day',type=int,default=20)
ap.add_argument('--pass-rate',type=float,default=0.8); ap.add_argument('--no-date-lock',action='store_true')
ap.add_argument('--out',required=True); ap.add_argument('--wrap',action='store_true',help='emit a full HTML document (for your own hosting)')
a=ap.parse_args()
here=pathlib.Path(__file__).resolve().parent; root=here.parent
src=(root/'ielts-studio.html').read_text()
def between(start,end):
    i=src.index(start); j=src.index(end,i); return src[i:j]
css=between('<style>','</style>')[len('<style>'):]+(here/'extra.css').read_text()
hero=between('const HEROES = {','const HERO_IMG =')
sound=between('const SB = {','let qInt=null;')
fx=between('/* battlefield effects','function sQuest(')
pagefx=between('/* ambient gold dust','boot();')
parse=between('function parseVocab','function tVocab')
img=lambda d,k:'data:image/jpeg;base64,'+base64.b64encode((root/'export/site/assets'/d/f'{k}.jpg').read_bytes()).decode()
cfg={'id':a.id,'cls':a.cls,'title':a.title,'perDay':a.per_day,'pass':a.pass_rate,'lockByDate':not a.no_date_lock,
 'weeks':[{'week':int(w.split('=')[0]),'tsv':pathlib.Path(w.split('=',1)[1]).read_text()} for w in a.week],
 'img':{'heroes':{k:img('heroes',k) for k in ['knight','princess','prince','ranger','sorceress']},'foes':{k:img('foes',k) for k in ['goblin','wolf','bandit','troll','blackknight']}}}
cfg['weeks'].sort(key=lambda w:w['week'])
core=(here/'core.js').read_text()
core=core.replace('/*PARSE_VOCAB*/',parse).replace('/*HERO_BLOCK*/',hero).replace('/*SOUND_BLOCK*/',sound).replace('/*FX_BLOCK*/',fx).replace('/*PAGE_FX*/',pagefx)
cfgjs='const CFG = '+json.dumps(cfg,ensure_ascii=False).replace('</','<\\/')+';\n'
fonts='<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..600&family=Jost:wght@400;500;600&display=swap">\n'
body=f'<title>{a.title}</title>\n{fonts}<style>\n{css}\n</style>\n<div id="app" class="shell" aria-live="polite"></div>\n<canvas id="page-fx" aria-hidden="true"></canvas>\n<div id="greet-root"></div>\n<div id="toast" class="toast" hidden></div>\n<script>\n{cfgjs}{core}\n</script>\n'
if a.wrap: body='<!doctype html>\n<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n'+body.replace('<div id="app"','</head><body>\n<div id="app"',1)+'</body></html>\n'
pathlib.Path(a.out).write_text(body); print(a.out, len(body)//1024,'KB')
