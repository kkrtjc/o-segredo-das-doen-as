const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'style.css');
const content = fs.readFileSync(cssPath, 'utf8');

// Find the last known good CSS block
const marker = '.checkout-company-info span:first-child {';
const markerIndex = content.lastIndexOf(marker);

if (markerIndex === -1) {
    console.error('Marker not found!');
    process.exit(1);
}

// Find the closing brace of that block
const closingBraceIndex = content.indexOf('}', markerIndex);

if (closingBraceIndex === -1) {
    console.error('Closing brace not found!');
    process.exit(1);
}

// Truncate everything after the closing brace
const cleanContent = content.substring(0, closingBraceIndex + 1);

// New CSS to append
const newCSS = `

/* Comparison Slider (Scroll Snap) */
.comparison-slider {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
}
.comparison-slider::-webkit-scrollbar { display: none; }

.comparison-slide {
    flex: 0 0 90%;
    scroll-snap-align: center;
    max-width: 600px;
}
.comparison-slide .comparison-item-v2 { height: 100%; }

@media (min-width: 768px) {
    .comparison-slider {
        justify-content: center;
        overflow-x: visible;
        scroll-snap-type: none;
        flex-wrap: wrap;
    }
    .comparison-slide {
        flex: 0 0 45%;
        max-width: none;
    }
}

/* Single-Slide Carousel Styles - FIXED */
.testimonial-carousel {
    position: relative !important;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    height: 400px;
    overflow: hidden;
}

.testimonial-track-original {
    position: relative;
    width: 100%;
    height: 100%;
}

.testimonial-card-single {
    background: rgba(20, 20, 20, 0.8);
    backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 3rem;
    box-shadow: 0 20px 50px rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: absolute; /* Controlled by JS, but good default */
    top: 0;
    left: 100%;
    width: 100%;
    height: 100%;
}
`;

fs.writeFileSync(cssPath, cleanContent + newCSS, 'utf8');
console.log('style.css fixed successfully.');
