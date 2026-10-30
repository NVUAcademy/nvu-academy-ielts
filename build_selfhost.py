# Rebuild export/site/index.html (self-hosted Firebase version) from ielts-studio.html
s=open('ielts-studio.html').read()
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:70],s.count(a)); s=s.replace(a,b)
s=s.replace('/_blob/${esc(it.assetId)}','${esc(blobUrl(it.assetId))}')
for k,h in {'knight':'35709fd067771555f600c4ecf212825a','princess':'3455c66beeb3d68db636902c3e83b326','prince':'0e8d25b107360f9f9fb323fe11a6e018','ranger':'9aa6838ad76f14e063663c7b717d1b58','sorceress':'1e5868302dd2bb7397cc3faf04601a5c'}.items():
    rep(f"'/_blob/{h}'", f"'assets/heroes/{k}.jpg'")
for k,h in {'goblin':'12c360279014634c574060a4de46c1d4','wolf':'08b30cea6c92cf4c1d24baed773baa95','bandit':'5c42cc1c45c815f876bb1a27fb9731b1','troll':'6bcd4609a5792a1d088a332cffdfdfd8','blackknight':'f8f585c94fddfd70179b2d08da0e3703'}.items():
    rep(f"'/_blob/{h}'", f"'assets/foes/{k}.jpg'")
rep("gateHero('This classroom runs inside claude.ai. Open the link there to sign in.')","gateHero('Sign in to enter the classroom.')")
rep("Reload the page while signed in to claude.ai.')","Check your internet connection and reload the page.')")
rep("Sign in to claude.ai, then reload this page to enter your class.","Sign in, then reload this page to enter your class.")
rep("Not saved: this account can’t write here. Ask your teacher to share the page with you as an Editor.","Not saved: this account can’t write here. Sign out and sign in again, or ask your teacher.")
rep("can’t be stored on this version of the site. Save it as PDF and attach that instead.","couldn’t be stored. Check that file uploads (Storage) are switched on for the site.")
head=open('export/site/_head.html').read() if False else '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#F8F2E9">
<style>html,body{margin:0}img{max-width:100%}[hidden]{display:none!important}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-storage-compat.js"></script>
<script src="firebase-config.js"></script>
<script src="claude-adapter.js"></script>
</head>
<body>
'''
open('export/site/index.html','w').write(head+s+'\n</body>\n</html>\n')
open('export/claude-artifact-version/ielts-studio.html','w').write(open('ielts-studio.html').read())
print('built')
