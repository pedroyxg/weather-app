import { Renderer, Program, Mesh, Triangle, Vec3 } from 'https://unpkg.com/ogl';

// --- ORB SHADER LOGIC ---
function initOrb() {
    const container = document.getElementById('orb-canvas-container');
    if (!container) return;

    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    container.appendChild(gl.canvas);

    // Shader Code (Ported from React)
    const vert = `
        precision highp float;
        attribute vec2 position;
        attribute vec2 uv;
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    const frag = `
        precision highp float;
        uniform float iTime;
        uniform vec3 iResolution;
        uniform float hue;
        uniform float hover;
        uniform float rot;
        uniform float hoverIntensity;
        varying vec2 vUv;

        vec3 rgb2yiq(vec3 c) {
            float y = dot(c, vec3(0.299, 0.587, 0.114));
            float i = dot(c, vec3(0.596, -0.274, -0.322));
            float q = dot(c, vec3(0.211, -0.523, 0.312));
            return vec3(y, i, q);
        }
        
        vec3 yiq2rgb(vec3 c) {
            float r = c.x + 0.956 * c.y + 0.621 * c.z;
            float g = c.x - 0.272 * c.y - 0.647 * c.z;
            float b = c.x - 1.106 * c.y + 1.703 * c.z;
            return vec3(r, g, b);
        }
        
        vec3 adjustHue(vec3 color, float hueDeg) {
            float hueRad = hueDeg * 3.14159265 / 180.0;
            vec3 yiq = rgb2yiq(color);
            float cosA = cos(hueRad);
            float sinA = sin(hueRad);
            float i = yiq.y * cosA - yiq.z * sinA;
            float q = yiq.y * sinA + yiq.z * cosA;
            yiq.y = i;
            yiq.z = q;
            return yiq2rgb(yiq);
        }

        vec3 hash33(vec3 p3) {
            p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
            p3 += dot(p3, p3.yxz + 19.19);
            return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
        }

        float snoise3(vec3 p) {
            const float K1 = 0.333333333;
            const float K2 = 0.166666667;
            vec3 i = floor(p + (p.x + p.y + p.z) * K1);
            vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
            vec3 e = step(vec3(0.0), d0 - d0.yzx);
            vec3 i1 = e * (1.0 - e.zxy);
            vec3 i2 = 1.0 - e.zxy * (1.0 - e);
            vec3 d1 = d0 - (i1 - K2);
            vec3 d2 = d0 - (i2 - K1);
            vec3 d3 = d0 - 0.5;
            vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
            vec4 n = h * h * h * h * vec4(dot(d0, hash33(i)), dot(d1, hash33(i + i1)), dot(d2, hash33(i + i2)), dot(d3, hash33(i + 1.0)));
            return dot(vec4(31.316), n);
        }

        vec4 extractAlpha(vec3 colorIn) {
            float a = max(max(colorIn.r, colorIn.g), colorIn.b);
            return vec4(colorIn.rgb / (a + 1e-5), a);
        }

        const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
        const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
        const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
        const float innerRadius = 0.6;
        const float noiseScale = 0.65;

        float light1(float intensity, float attenuation, float dist) {
            return intensity / (1.0 + dist * attenuation);
        }
        float light2(float intensity, float attenuation, float dist) {
            return intensity / (1.0 + dist * dist * attenuation);
        }

        vec4 draw(vec2 uv) {
            vec3 color1 = adjustHue(baseColor1, hue);
            vec3 color2 = adjustHue(baseColor2, hue);
            vec3 color3 = adjustHue(baseColor3, hue);
            
            float ang = atan(uv.y, uv.x);
            float len = length(uv);
            float invLen = len > 0.0 ? 1.0 / len : 0.0;
            
            float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
            float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
            float d0 = distance(uv, (r0 * invLen) * uv);
            float v0 = light1(1.0, 10.0, d0);
            v0 *= smoothstep(r0 * 1.05, r0, len);
            float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;
            
            float a = iTime * -1.0;
            vec2 pos = vec2(cos(a), sin(a)) * r0;
            float d = distance(uv, pos);
            float v1 = light2(1.5, 5.0, d);
            v1 *= light1(1.0, 50.0, d0);
            
            float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
            float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);
            
            vec3 col = mix(color1, color2, cl);
            col = mix(color3, col, v0);
            col = (col + v1) * v2 * v3;
            col = clamp(col, 0.0, 1.0);
            
            return extractAlpha(col);
        }

        vec4 mainImage(vec2 fragCoord) {
            vec2 center = iResolution.xy * 0.5;
            float size = min(iResolution.x, iResolution.y);
            vec2 uv = (fragCoord - center) / size * 2.0;
            
            float angle = rot;
            float s = sin(angle);
            float c = cos(angle);
            uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
            
            uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
            uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);
            
            return draw(uv);
        }

        void main() {
            vec2 fragCoord = vUv * iResolution.xy;
            vec4 col = mainImage(fragCoord);
            gl_FragColor = vec4(col.rgb * col.a, col.a);
        }
    `;

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
        vertex: vert,
        fragment: frag,
        uniforms: {
            iTime: { value: 0 },
            iResolution: { value: new Vec3(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height) },
            hue: { value: 0 },
            hover: { value: 0 },
            rot: { value: 0 },
            hoverIntensity: { value: 0.4 } // Set default intensity
        }
    });

    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        renderer.setSize(width * dpr, height * dpr);
        gl.canvas.style.width = width + 'px';
        gl.canvas.style.height = height + 'px';
        program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    // Interactive Logic
    let targetHover = 0;
    let lastTime = 0;
    let currentRot = 0;
    
    // Map mouse over entire window for background effect
    window.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        const w = window.innerWidth;
        const h = window.innerHeight;
        
        // Simple logic: Closer to center = more hover effect
        const cx = w/2;
        const cy = h/2;
        const dist = Math.sqrt(Math.pow(x-cx, 2) + Math.pow(y-cy, 2));
        const maxDist = Math.sqrt(Math.pow(w, 2) + Math.pow(h, 2)) / 2;
        
        // Inverse distance: 1 at center, 0 at edges
        const normDist = 1 - Math.min(dist / (maxDist * 0.8), 1);
        targetHover = normDist; 
    });

    requestAnimationFrame(update);
    function update(t) {
        requestAnimationFrame(update);
        const dt = (t - lastTime) * 0.001;
        lastTime = t;
        program.uniforms.iTime.value = t * 0.001;
        
        // Smoothly update hover uniform
        program.uniforms.hover.value += (targetHover - program.uniforms.hover.value) * 0.05;
        
        // Rotate slowly
        currentRot += dt * 0.1;
        program.uniforms.rot.value = currentRot;

        renderer.render({ scene: mesh });
    }
}

// Initialize Orb
initOrb();

// --- REST OF APP LOGIC (ATTACHED TO WINDOW FOR GLOBAL ACCESS) ---
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const AIR_API = "https://air-quality-api.open-meteo.com/v1/air-quality";

function degToCompass(num) { const val = Math.floor((num / 22.5) + 0.5); return ["U", "TL", "TL", "T", "T", "Teng", "Teng", "S", "S", "BD", "BD", "B", "B", "BL", "BL", "U"][(val % 16)]; }
function getWeatherDesc(code) { const codes = { 0:{l:"Cerah",i:"sun"}, 1:{l:"Cerah Berawan",i:"cloud-sun"}, 2:{l:"Berawan",i:"cloud"}, 3:{l:"Mendung",i:"cloudy"}, 45:{l:"Kabut",i:"align-justify"}, 51:{l:"Gerimis",i:"cloud-drizzle"}, 53:{l:"Gerimis",i:"cloud-drizzle"}, 61:{l:"Hujan Ringan",i:"cloud-rain"}, 63:{l:"Hujan",i:"cloud-rain"}, 65:{l:"Hujan Lebat",i:"cloud-lightning"}, 80:{l:"Hujan Lokal",i:"cloud-rain"}, 95:{l:"Badai Petir",i:"zap"} }; return codes[code] || {l:"Unknown",i:"help-circle"}; }
function getAQIStatus(aqi) { if (aqi <= 50) return { t: "Baik", c: "bg-green-500", w: "20%" }; if (aqi <= 100) return { t: "Sedang", c: "bg-yellow-500", w: "40%" }; if (aqi <= 150) return { t: "Tidak Sehat (Sensitif)", c: "bg-orange-500", w: "60%" }; if (aqi <= 200) return { t: "Tidak Sehat", c: "bg-red-500", w: "80%" }; return { t: "Berbahaya", c: "bg-purple-500", w: "100%" }; }
function getUVStatus(uv) { if (uv <= 2) return { t: "Low", c: "bg-green-500", w: "20%" }; if (uv <= 5) return { t: "Mod", c: "bg-yellow-500", w: "50%" }; if (uv <= 7) return { t: "High", c: "bg-orange-500", w: "75%" }; return { t: "Extreme", c: "bg-red-500", w: "100%" }; }

let currentCityTimeZone = 'Asia/Jakarta';
function startClock() {
    const display = document.getElementById('clock-display');
    setInterval(() => { const now = new Date(); try { display.innerText = now.toLocaleTimeString('id-ID', { hour12: false, timeZone: currentCityTimeZone }); } catch (e) { display.innerText = now.toLocaleTimeString('id-ID', { hour12: false }); } }, 1000);
}

const ui = { loc: document.getElementById('location-text'), temp: document.getElementById('temp-main'), high: document.getElementById('temp-high'), low: document.getElementById('temp-low'), cond: document.getElementById('condition-text'), date: document.getElementById('date-text'), day: document.getElementById('day-text'), iconLg: document.getElementById('weather-icon-lg'), wind: document.getElementById('wind-val'), windDir: document.getElementById('wind-dir-text'), windArrow: document.getElementById('wind-arrow'), uv: document.getElementById('uv-val'), uvText: document.getElementById('uv-text'), uvBar: document.getElementById('uv-bar'), sunrise: document.getElementById('sunrise-val'), sunset: document.getElementById('sunset-val'), aqiVal: document.getElementById('aqi-val'), aqiText: document.getElementById('aqi-text'), aqiBar: document.getElementById('aqi-bar'), humid: document.getElementById('humidity-val'), vis: document.getElementById('vis-val'), hourly: document.getElementById('hourly-container'), content: document.getElementById('dashboard-content'), loader: document.getElementById('btn-loader'), btnIcon: document.getElementById('btn-icon'), error: document.getElementById('error-msg'), suggestions: document.getElementById('suggestions-container'), searchInput: document.getElementById('search-input') };

let debounceTimer;
ui.searchInput.addEventListener('input', (e) => { const query = e.target.value.trim(); clearTimeout(debounceTimer); if (query.length < 3) { hideSuggestions(); return; } showLoadingSuggestions(); debounceTimer = setTimeout(() => fetchSuggestions(query), 300); });
document.addEventListener('click', (e) => { if (!ui.searchInput.contains(e.target) && !ui.suggestions.contains(e.target)) hideSuggestions(); });
function showLoadingSuggestions() { ui.suggestions.classList.add('active'); ui.suggestions.innerHTML = `<div class="px-5 py-4 text-sm text-gray-400 flex items-center gap-3"><div class="loader !w-4 !h-4 !border-2 !border-purple-400 !border-t-transparent"></div>Mencari kota...</div>`; }
function renderNoResults() { ui.suggestions.classList.add('active'); ui.suggestions.innerHTML = `<div class="px-5 py-4 text-sm text-gray-500 italic">Kota tidak ditemukan.</div>`; }
function hideSuggestions() { ui.suggestions.classList.remove('active'); }
async function fetchSuggestions(query) { try { const res = await fetch(`${GEO_API}?name=${query}&count=5&language=id&format=json`); const data = await res.json(); if (data.results && data.results.length > 0) renderSuggestions(data.results); else renderNoResults(); } catch (err) { console.error("Error", err); renderNoResults(); } }
function renderSuggestions(results) { ui.suggestions.innerHTML = ''; ui.suggestions.classList.add('active'); results.forEach(city => { const item = document.createElement('div'); item.className = 'suggestion-item'; const adminArea = city.admin1 ? `, ${city.admin1}` : ''; const flag = getFlagEmoji(city.country_code); item.innerHTML = `<div class="bg-white/5 p-2 rounded-lg text-purple-400"><i data-lucide="map-pin" class="w-4 h-4"></i></div><div class="suggestion-info"><span class="suggestion-name text-white">${city.name} ${flag}</span><span class="suggestion-country">${city.country}${adminArea}</span></div>`; item.addEventListener('click', () => { ui.searchInput.value = `${city.name}`; hideSuggestions(); loadAllData(city.latitude, city.longitude, `${city.name}, ${city.country_code}`); }); ui.suggestions.appendChild(item); }); lucide.createIcons(); }
function getFlagEmoji(countryCode) { if(!countryCode) return ''; const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt()); return String.fromCodePoint(...codePoints); }

function setLoading(state) { if(state) { ui.loader.classList.remove('hidden'); ui.btnIcon.classList.add('hidden'); ui.content.style.opacity = '0.5'; } else { ui.loader.classList.add('hidden'); ui.btnIcon.classList.remove('hidden'); ui.content.style.opacity = '1'; } }
async function loadAllData(lat, lon, locationName) { setLoading(true); try { const weatherUrl = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode,uv_index,relativehumidity_2m,visibility&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`; const airUrl = `${AIR_API}?latitude=${lat}&longitude=${lon}&current=us_aqi`; const [weatherRes, airRes] = await Promise.all([fetch(weatherUrl), fetch(airUrl)]); const weatherData = await weatherRes.json(); const airData = await airRes.json(); if (weatherData.timezone) { currentCityTimeZone = weatherData.timezone; document.getElementById('timezone-display').innerText = currentCityTimeZone.split('/')[1].toUpperCase().replace('_', ' '); } renderUI(weatherData, airData, locationName); } catch(err) { console.error(err); } finally { setLoading(false); } }
function renderUI(wData, aData, location) { const current = wData.current_weather; const daily = wData.daily; const desc = getWeatherDesc(current.weathercode); ui.loc.innerText = location; const now = new Date(); ui.date.innerText = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: currentCityTimeZone }); ui.day.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', timeZone: currentCityTimeZone }); ui.temp.innerText = Math.round(current.temperature); ui.cond.innerText = desc.l; ui.high.innerText = Math.round(daily.temperature_2m_max[0]); ui.low.innerText = Math.round(daily.temperature_2m_min[0]); ui.iconLg.innerHTML = `<i data-lucide="${desc.i}" class="w-12 h-12 text-white drop-shadow-md"></i>`; ui.wind.innerText = current.windspeed; ui.windDir.innerText = degToCompass(current.winddirection); const windArrowWrapper = document.getElementById('wind-arrow-wrapper'); if(windArrowWrapper) { windArrowWrapper.style.transform = `rotate(${current.winddirection}deg)`; } let hourIdx = wData.hourly.time.findIndex(t => t === current.time); if (hourIdx === -1) hourIdx = 0; const uvNow = wData.hourly.uv_index[hourIdx]; const uvStat = getUVStatus(uvNow); ui.uv.innerText = uvNow.toFixed(1); ui.uvText.innerText = uvStat.t; const uvBar = document.getElementById('uv-bar'); if(uvBar) { uvBar.className = `progress-fill ${uvStat.c}`; uvBar.style.width = uvStat.w; } ui.sunrise.innerText = daily.sunrise[0].split('T')[1]; ui.sunset.innerText = daily.sunset[0].split('T')[1]; const aqiNow = aData.current.us_aqi; const aqiStat = getAQIStatus(aqiNow); ui.aqiVal.innerText = aqiNow; ui.aqiText.innerText = aqiStat.t; const aqiBar = document.getElementById('aqi-bar'); if(aqiBar) { aqiBar.className = `progress-fill ${aqiStat.c}`; aqiBar.style.width = aqiStat.w; } const humid = wData.hourly.relativehumidity_2m[hourIdx]; const vis = wData.hourly.visibility[hourIdx]; ui.humid.innerText = `${humid}%`; ui.vis.innerText = `${(vis/1000).toFixed(1)} km`; ui.hourly.innerHTML = ''; for(let i = hourIdx; i < hourIdx + 24; i++) { if(!wData.hourly.time[i]) break; const t = wData.hourly.time[i].split('T')[1]; const tmp = Math.round(wData.hourly.temperature_2m[i]); const c = wData.hourly.weathercode[i]; const isNow = i === hourIdx; const borderClass = isNow ? 'border-purple-500/50 bg-white/10 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'border-transparent hover:border-white/10 hover:bg-white/5'; const textClass = isNow ? 'text-white font-bold' : 'text-gray-400'; ui.hourly.innerHTML += `<div class="snap-start min-w-[70px] flex flex-col items-center justify-center p-4 rounded-2xl transition-all cursor-default border ${borderClass}"><span class="text-xs mb-3 font-mono ${textClass}">${t}</span><i data-lucide="${getWeatherDesc(c).i}" class="w-6 h-6 text-white mb-2 drop-shadow-sm"></i><span class="text-lg font-bold text-white">${tmp}°</span></div>`; } lucide.createIcons(); ui.content.style.opacity = '1'; }

// Global functions for HTML events
window.searchCity = async (q) => { setLoading(true); ui.error.classList.add('hidden'); hideSuggestions(); try { const res = await fetch(`${GEO_API}?name=${q}&count=1&language=id&format=json`); const d = await res.json(); if(!d.results) throw new Error(); loadAllData(d.results[0].latitude, d.results[0].longitude, `${d.results[0].name}, ${d.results[0].country_code}`); } catch { ui.error.classList.remove('hidden'); setLoading(false); } };

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('bento-grid'); const cards = document.querySelectorAll('.magic-card'); if(grid) grid.addEventListener('mousemove', e => { cards.forEach(c => { const r = c.getBoundingClientRect(); c.style.setProperty('--mouse-x', `${e.clientX - r.left}px`); c.style.setProperty('--mouse-y', `${e.clientY - r.top}px`); }); }); cards.forEach(c => { c.addEventListener('mousemove', (e) => { const r = c.getBoundingClientRect(); const x = ((e.clientY - r.top)/(r.height/2))*-5; const y = ((e.clientX - r.left)/(r.width/2))*5; gsap.to(c, { rotateX: x, rotateY: y, scale: 0.98, duration: 0.3 }); }); c.addEventListener('mouseleave', () => gsap.to(c, { rotateX: 0, rotateY: 0, scale: 1 })); });
    const mainCard = document.getElementById('main-weather-card'); if(mainCard) { mainCard.addEventListener('mousemove', (e) => { const rect = mainCard.getBoundingClientRect(); const x = e.clientX - rect.left; const y = e.clientY - rect.top; mainCard.style.setProperty('--mouse-x', `${x}px`); mainCard.style.setProperty('--mouse-y', `${y}px`); }); }
    startClock();
    window.searchCity("Jakarta");
});

document.getElementById('search-form').addEventListener('submit', (e) => { e.preventDefault(); window.searchCity(document.getElementById('search-input').value); });