// Comparison Slider Navigation Logic
const comparisonSlider = document.getElementById('comparison-slider-track');
const prevButton = document.getElementById('comparison-prev');
const nextButton = document.getElementById('comparison-next');

if (comparisonSlider && prevButton && nextButton) {
    prevButton.addEventListener('click', () => {
        const slideWidth = comparisonSlider.querySelector('.comparison-slide').offsetWidth;
        comparisonSlider.scrollBy({
            left: -slideWidth,
            behavior: 'smooth'
        });
    });

    nextButton.addEventListener('click', () => {
        const slideWidth = comparisonSlider.querySelector('.comparison-slide').offsetWidth;
        comparisonSlider.scrollBy({
            left: slideWidth,
            behavior: 'smooth'
        });
    });
}
