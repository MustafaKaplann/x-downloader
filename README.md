# 🐦 Twitter Video İndirici

## 🚀 Kurulum
```bash
# 1. Bağımlılıkları yükle
npm install

# 2. .env dosyası oluştur
cp .env.example .env

# 3. yt-dlp kur (Linux/Mac)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# 4. Sunucuyu başlat
npm start
```

## 📦 Deployment

### Vercel (En Kolay)
```bash
npm i -g vercel
vercel
```