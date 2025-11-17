const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// RapidAPI Twitter Video Downloader (Ücretsiz tier)
const RAPIDAPI_KEY = 'YOUR_RAPIDAPI_KEY'; // RapidAPI'den alınacak
const RAPIDAPI_HOST = 'twitter-downloader-download-twitter-videos-gifs-and-images.p.rapidapi.com';

// Alternative: Twitter Video Downloader API
async function getVideoInfoRapidAPI(tweetUrl) {
    try {
        const options = {
            method: 'GET',
            url: 'https://twitter-downloader-download-twitter-videos-gifs-and-images.p.rapidapi.com/status',
            params: { url: tweetUrl },
            headers: {
                'X-RapidAPI-Key': RAPIDAPI_KEY,
                'X-RapidAPI-Host': RAPIDAPI_HOST
            }
        };

        const response = await axios.request(options);
        return response.data;
    } catch (error) {
        throw error;
    }
}

// Alternative: yt-dlp (Tamamen ücretsiz, sunucuda kurulu olmalı)
async function getVideoInfoYtDlp(tweetUrl) {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    try {
        const command = `yt-dlp -j --no-warnings "${tweetUrl}"`;
        const { stdout } = await execPromise(command);
        const info = JSON.parse(stdout);
        
        // Video formatlarını düzenle
        const formats = info.formats || [];
        const videoFormats = formats.filter(f => f.vcodec !== 'none' && f.acodec !== 'none');
        const audioFormats = formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
        
        return {
            success: true,
            title: info.title || 'Twitter Video',
            thumbnail: info.thumbnail,
            duration: info.duration,
            formats: {
                high: videoFormats.find(f => f.height >= 720)?.url || videoFormats[0]?.url,
                medium: videoFormats.find(f => f.height >= 480 && f.height < 720)?.url || videoFormats[0]?.url,
                low: videoFormats.find(f => f.height < 480)?.url || videoFormats[0]?.url,
                audio: audioFormats[0]?.url || null
            },
            videoUrl: videoFormats[0]?.url,
            audioUrl: audioFormats[0]?.url
        };
    } catch (error) {
        throw error;
    }
}

// Alternative 3: Twitter API v2 with Bearer Token (Ücretsiz - 500k tweet/month)
async function getVideoInfoTwitterAPI(tweetUrl) {
    try {
        // Tweet ID'sini çıkar
        const tweetId = tweetUrl.match(/status\/(\d+)/)?.[1];
        if (!tweetId) throw new Error('Invalid tweet URL');

        // Twitter API v2 - Bearer token gerekli ama ücretsiz
        // https://developer.twitter.com/en/portal/dashboard
        const bearerToken = process.env.TWITTER_BEARER_TOKEN;
        
        if (!bearerToken) {
            throw new Error('Twitter Bearer Token not configured');
        }

        const apiUrl = `https://api.twitter.com/2/tweets/${tweetId}?expansions=attachments.media_keys&media.fields=variants,url,preview_image_url,duration_ms`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'Authorization': `Bearer ${bearerToken}`
            }
        });

        const mediaData = response.data.includes?.media?.[0];
        
        if (!mediaData || mediaData.type !== 'video') {
            throw new Error('No video found in tweet');
        }

        // Video varyantlarını kaliteye göre sırala
        const variants = mediaData.variants
            .filter(v => v.content_type === 'video/mp4')
            .sort((a, b) => (b.bit_rate || 0) - (a.bit_rate || 0));

        return {
            success: true,
            title: 'Twitter Video',
            thumbnail: mediaData.preview_image_url,
            duration: mediaData.duration_ms / 1000,
            formats: {
                high: variants[0]?.url,
                medium: variants[Math.floor(variants.length / 2)]?.url || variants[0]?.url,
                low: variants[variants.length - 1]?.url
            },
            videoUrl: variants[0]?.url
        };
    } catch (error) {
        throw error;
    }
}

// Alternative 4: Ücretsiz Twitter Downloader API'leri
async function getVideoInfoFreeAPI(tweetUrl) {
    try {
        // Alternatif 1: Twitter Video Downloader API (Tamamen ücretsiz)
        const response = await axios.post('https://twitsave.com/info', {
            url: tweetUrl
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Response'u parse et
        if (response.data && response.data.url) {
            return {
                success: true,
                title: response.data.title || 'Twitter Video',
                thumbnail: response.data.thumbnail,
                duration: response.data.duration,
                formats: {
                    high: response.data.url,
                    medium: response.data.url,
                    low: response.data.url
                },
                videoUrl: response.data.url
            };
        }

        throw new Error('Video not found');
    } catch (error) {
        // Alternatif 2: SaveTweetVid API
        try {
            const tweetId = tweetUrl.match(/status\/(\d+)/)?.[1];
            const response2 = await axios.get(`https://www.savetweetvid.com/downloader`, {
                params: { url: tweetUrl }
            });
            
            // HTML'den video URL'ini çıkar
            const videoRegex = /https:\/\/video\.twimg\.com\/[^"'\s]+/g;
            const matches = response2.data.match(videoRegex);
            
            if (matches && matches.length > 0) {
                return {
                    success: true,
                    title: 'Twitter Video',
                    formats: {
                        high: matches[0],
                        medium: matches[0],
                        low: matches[0]
                    },
                    videoUrl: matches[0]
                };
            }
        } catch (err2) {
            console.log('SaveTweetVid failed:', err2.message);
        }
        
        throw new Error('All free API methods failed');
    }
}

//  Vxtwitter (ücretsiz)
async function getVideoInfoVxTwitter(tweetUrl) {
    try {
        // vxtwitter - Twitter video proxy
        // twitter.com -> vxtwitter.com
        const vxUrl = tweetUrl.replace('twitter.com', 'api.vxtwitter.com').replace('x.com', 'api.vxtwitter.com');
        
        const response = await axios.get(vxUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        const data = response.data;
        
        if (!data.media_extended || data.media_extended.length === 0) {
            throw new Error('No media found');
        }

        const video = data.media_extended.find(m => m.type === 'video');
        
        if (!video) {
            throw new Error('No video found');
        }

        return {
            success: true,
            title: data.text || 'Twitter Video',
            thumbnail: video.thumbnail_url,
            duration: video.duration,
            formats: {
                high: video.url,
                medium: video.url,
                low: video.url
            },
            videoUrl: video.url
        };
    } catch (error) {
        throw error;
    }
}

// Ana endpoint
app.post('/api/get-video', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: 'URL gereklidir' 
            });
        }

        // URL doğrulama
        if (!url.includes('twitter.com') && !url.includes('x.com')) {
            return res.status(400).json({ 
                success: false, 
                error: 'Geçerli bir Twitter/X linki değil' 
            });
        }

        let videoInfo;
        const errors = [];

        // 1. yt-dlp'yi (en güvenilir - ama sunucuda kurulu olmalı)
        try {
            console.log('Trying yt-dlp...');
            videoInfo = await getVideoInfoYtDlp(url);
            return res.json(videoInfo);
        } catch (ytDlpError) {
            errors.push(`yt-dlp: ${ytDlpError.message}`);
            console.log('yt-dlp failed:', ytDlpError.message);
        }

        // 2. VxTwitter API (En iyi ücretsiz yöntem)
        try {
            console.log('Trying VxTwitter...');
            videoInfo = await getVideoInfoVxTwitter(url);
            return res.json(videoInfo);
        } catch (vxError) {
            errors.push(`VxTwitter: ${vxError.message}`);
            console.log('VxTwitter failed:', vxError.message);
        }

        // 3. Twitter API v2 (Bearer token varsa) paralı
        if (process.env.TWITTER_BEARER_TOKEN) {
            try {
                console.log('Trying Twitter API v2...');
                videoInfo = await getVideoInfoTwitterAPI(url);
                return res.json(videoInfo);
            } catch (twitterApiError) {
                errors.push(`Twitter API: ${twitterApiError.message}`);
                console.log('Twitter API failed:', twitterApiError.message);
            }
        }

        // 4. RapidAPI (API key varsa) bitince paralı
        if (RAPIDAPI_KEY && RAPIDAPI_KEY !== 'YOUR_RAPIDAPI_KEY') {
            try {
                console.log('Trying RapidAPI...');
                videoInfo = await getVideoInfoRapidAPI(url);
                return res.json(videoInfo);
            } catch (rapidApiError) {
                errors.push(`RapidAPI: ${rapidApiError.message}`);
                console.log('RapidAPI failed:', rapidApiError.message);
            }
        }

        // 5. Diğer ücretsiz API'ler
        try {
            console.log('Trying free APIs...');
            videoInfo = await getVideoInfoFreeAPI(url);
            return res.json(videoInfo);
        } catch (freeApiError) {
            errors.push(`Free APIs: ${freeApiError.message}`);
            console.log('Free APIs failed:', freeApiError.message);
        }

        // Hiçbiri çalışmadıysa
        console.error('All methods failed:', errors);
        res.status(500).json({ 
            success: false, 
            error: 'Video bulunamadı. Lütfen daha sonra tekrar deneyin.',
            details: errors
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Video bilgileri alınamadı. Lütfen tekrar deneyin.' 
        });
    }
});

// Video download endpoint
app.get('/api/download', async (req, res) => {
    try {
        const { url, quality = 'high' } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL gereklidir' });
        }

        // Video URL'den stream oluştur
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream'
        });

        // Headers ayarla
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', 'attachment; filename="twitter-video.mp4"');

        // Stream'i pipe et
        response.data.pipe(res);

    } catch (error) {
        console.error('Download error:', error.message);
        res.status(500).json({ error: 'İndirme başarısız oldu' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api/get-video`);
});