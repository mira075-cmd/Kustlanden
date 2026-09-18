# Kustlanden

Browser-bordspel met hex-tegels, grondstoffen, nederzettingen, paden, steden, dobbelsteen en zwerver.

Dit is een **eigen spel**. Geen officiële Catan-editie, geen Catan-naam, geen Catan-kunst.

## Spelen

Open `index.html` in de browser, of host de map op Cloudflare Pages / GitHub Pages.

Op Android: Chrome → menu → **Toevoegen aan startscherm** (PWA).

## APK

```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init Kustlanden app.kustlanden.game --web-dir .
npx cap add android
npx cap copy
npx cap open android
```

Daarna in Android Studio een signed APK/AAB bouwen.

## Beurt

1. Plaats 2 nederzettingen en 2 paden.
2. Dobbel. Getal = opbrengst (behalve tegel met zwerver).
3. 7: helft weg bij >7 kaarten, verplaats zwerver.
4. Bouw of wissel 4:1 met de bank.
5. 10 VP wint.
