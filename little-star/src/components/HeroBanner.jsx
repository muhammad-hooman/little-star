import React from 'react'
import { useManagedSite } from '../lib/ManagedSiteContext'
import heroVideo from '../../Untitled_Scene_11-04_16_49_36_20261104215102.mp4'

const SLIDES = [
  {
    season: 'Bespoke occasionwear for little gentlemen',
    headline: 'Little Stars.\nBig Style.',
    description: 'Discover timeless outfits for everyday adventures, special celebrations, and unforgettable little moments. Handcrafted for ages 1–13.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCD5cYks7Tf8e_zfKaX2vd6XGTuhFeajcqYNxUopDtj3ahh4LcKYTjX1JfNhKmxl4mzd2im0_Z0TbBjCDsW9fYiBVDWF9kSzE3r5XRaAhZTZHZqnPuMuJQALpL0XXq-SEYoWSZxskq5pqk2H2sZbutHybIigM2qaI582CgsUnlzhU1Vc_X4vZ491yVQpiQiqPHgf19i2laqp2iax4zfyM89M7Y1A_lqxcyWLYwHXMKt4DJKHBd5CXSu',
    alt: "Stylish young model in tailored luxury children's clothing"
  },
  {
    season: 'Considered tailoring, made for childhood',
    headline: 'Handcrafted\nElegance.',
    description: 'Impeccable Italian-cut coat pants and handcrafted sherwanis, finished with heirloom attention to detail.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOHZj7Sep-7290IsgdzITdlnbtIx0TGNaA-iXSGMyu6RrqjvDbWlcExEEXGAjA_X2uQn1HuhdY7Ec1RWTRp34OkCT3M8mpOhFuYxIl0E_I7LHBx_ORIByEqdXuu94Ye4sRA04V6bbTCrIQVN0IRve6ylZ8tCBSX9sXTbxnVrW1CtO65TqU88u9mUrOWtTAxF9-yMP_mjxqdwgp61w8RsmaHSDPgZyzxfa-SuU04I4u5IsH6fi218oj',
    alt: "Tailored luxury formal suit"
  }
]

export default function HeroBanner() {
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const { getPublishedRows, resolveImage } = useManagedSite()
  const managedSlides = getPublishedRows('hero')
  const slides = managedSlides.length
    ? managedSlides.map(({ payload }, index) => ({
        ...SLIDES[index % SLIDES.length],
        ...payload,
        image: resolveImage(payload.image_key, SLIDES[index % SLIDES.length].image),
        mobileImage: payload.mobile_image_key
          ? resolveImage(payload.mobile_image_key, '')
          : '',
        alt: payload.alt_text || SLIDES[index % SLIDES.length].alt
      }))
    : SLIDES
  const slide = slides[0]
  const primaryLinkText = (slide.link_text || 'Shop collection').replace(/\s*[→↗]\s*$/, '')

  return (
    <section className="hero-video-banner ls-hero" data-purpose="hero-background-video">
      <img
        className="hero-video-fallback ls-hero-media"
        src={slide.image}
        alt=""
        aria-hidden="true"
      />
      <video
        className="hero-video-media ls-hero-media"
        style={{ filter: 'brightness(1.12)' }}
        autoPlay={!prefersReducedMotion}
        loop
        muted
        playsInline
        preload={prefersReducedMotion ? 'none' : 'metadata'}
        poster={slide.image}
        aria-hidden="true"
      >
        <source src={heroVideo} type="video/mp4" />
      </video>
      <div className="hero-video-overlay ls-hero-scrim" aria-hidden="true" />
      <div className="hero-video-content ls-hero-layout">
        <div className="hero-video-copy ls-hero-copy">
          <span className="ls-eyebrow">
            {slide.season}
          </span>
          <h1>
            {slide.headline.split('\n').map((line, index) => <React.Fragment key={line}>{index > 0 && <br />}<span className={index > 0 ? 'is-italic' : ''}>{line}</span></React.Fragment>)}
          </h1>
          <p>
            {slide.description}
          </p>
          <div className="ls-hero-actions">
            <a
              className="ls-button ls-button-primary"
              href={slide.link_href || '#/new-arrivals'}
            >
              {primaryLinkText}<span aria-hidden="true">→</span>
            </a>
            <a
              className="ls-button ls-button-secondary"
              href="#/new-arrivals"
            >
              Explore new arrivals<span aria-hidden="true">↗</span>
            </a>
          </div>
          <span className="ls-film-note"><i aria-hidden="true" />Campaign film · muted</span>
        </div>
      </div>
    </section>
  )
}