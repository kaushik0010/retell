import React from "react";

interface LostDocumentIllustrationProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export function LostDocumentIllustration({
  className = "w-full max-w-[440px] sm:max-w-[480px] h-auto",
  width,
  height,
}: LostDocumentIllustrationProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 520 360"
      fill="none"
      role="img"
      aria-label="Illustration of a cute worried paper document character looking for a missing page next to a wooden directional signpost"
      className={className}
      width={width}
      height={height}
    >
      <title>Oops! This answer isn&apos;t here</title>
      <defs>
        <style>{`
          @keyframes floatDocument {
            0%, 100% {
              transform: translateY(0px) rotate(-2deg);
            }
            50% {
              transform: translateY(-8px) rotate(-1deg);
            }
          }

          @keyframes floatMarks {
            0%, 100% {
              transform: translateY(0px) scale(1);
            }
            50% {
              transform: translateY(-6px) scale(1.05);
            }
          }

          @keyframes blinkEyes {
            0%, 93%, 100% {
              transform: scaleY(1);
            }
            96% {
              transform: scaleY(0.1);
            }
          }

          @keyframes shadowPulse {
            0%, 100% {
              transform: scale(1);
              opacity: 0.85;
            }
            50% {
              transform: scale(0.95);
              opacity: 0.65;
            }
          }

          .anim-document {
            animation: floatDocument 4s ease-in-out infinite;
            transform-origin: 242px 260px;
          }

          .anim-marks {
            animation: floatMarks 3s ease-in-out infinite;
            transform-origin: 305px 85px;
          }

          .anim-eyes {
            animation: blinkEyes 4.5s ease-in-out infinite;
            transform-origin: 242px 184px;
          }

          .anim-shadow {
            animation: shadowPulse 4s ease-in-out infinite;
            transform-origin: 250px 308px;
          }

          @media (prefers-reduced-motion: reduce) {
            .anim-document,
            .anim-marks,
            .anim-eyes,
            .anim-shadow {
              animation: none !important;
              transform: none !important;
            }
          }
        `}</style>
      </defs>

      {/* 1. Soft Ground Shadow */}
      <ellipse
        cx="250"
        cy="308"
        rx="145"
        ry="15"
        fill="#F4E6D2"
        className="anim-shadow"
      />

      {/* 2. Left Bush (Gentle sage green mounds) */}
      <g id="bush-left">
        {/* Back Mound */}
        <path
          d="M135 304 C122 296 122 274 138 262 C152 250 174 256 182 270 C194 268 206 280 204 298 C204 304 195 306 178 306 Z"
          fill="#98AB82"
        />
        {/* Front Mound */}
        <path
          d="M152 306 C140 297 144 280 158 272 C172 263 190 270 194 284 C202 284 208 293 204 305 Z"
          fill="#A7B990"
        />
      </g>

      {/* 3. Right Bush (Nestled around signpost base) */}
      <g id="bush-right">
        {/* Back Mound */}
        <path
          d="M312 306 C300 292 306 270 324 262 C340 255 360 264 366 280 C375 277 388 285 390 298 C391 306 380 308 362 308 Z"
          fill="#98AB82"
        />
        {/* Front Mound */}
        <path
          d="M336 308 C328 298 333 282 346 277 C359 270 376 277 380 289 C387 291 393 301 386 308 Z"
          fill="#A7B990"
        />
      </g>

      {/* 4. Wooden Directional Signpost */}
      <g id="signpost">
        {/* Vertical Post */}
        <rect
          x="343"
          y="136"
          width="13"
          height="168"
          rx="3"
          fill="#D8C2A7"
          stroke="#9C8164"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Top Arrow Sign (Pointing up-right / right) */}
        <g transform="rotate(-6 350 162)">
          <path
            d="M 320 148 L 372 148 L 388 162 L 372 176 L 320 176 C 317 176 315 174 315 171 L 315 153 C 315 150 317 148 320 148 Z"
            fill="#F1DFCE"
            stroke="#9C8164"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Wood Grain Detail & Center Nail */}
          <path
            d="M 326 156 L 366 156"
            stroke="#E0CEBC"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="349.5" cy="162" r="2.2" fill="#7E654C" />
        </g>

        {/* Bottom Arrow Sign (Pointing down-right / right) */}
        <g transform="rotate(4 350 200)">
          <path
            d="M 348 186 L 384 186 L 400 200 L 384 214 L 348 214 C 345 214 343 212 343 209 L 343 191 C 343 188 345 186 348 186 Z"
            fill="#F1DFCE"
            stroke="#9C8164"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Wood Grain Detail & Center Nail */}
          <path
            d="M 352 194 L 378 194"
            stroke="#E0CEBC"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="349.5" cy="200" r="2.2" fill="#7E654C" />
        </g>
      </g>

      {/* 5. Paper Character (Floating gently) */}
      <g id="paper-character" className="anim-document">
        {/* Legs & Feet */}
        <g id="character-legs">
          {/* Left Leg */}
          <path
            d="M 218 268 L 214 294 C 214 297 210 298 202 298"
            stroke="#7E4E2C"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Right Leg */}
          <path
            d="M 256 268 L 258 294 C 258 297 262 298 270 298"
            stroke="#7E4E2C"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* Paper Document Body with Top-Left Fold */}
        <g id="character-body">
          {/* Document Sheet */}
          <path
            d="M 218 115 L 282 115 A 14 14 0 0 1 296 129 L 296 256 A 14 14 0 0 1 282 270 L 202 270 A 14 14 0 0 1 188 256 L 188 148 L 218 115 Z"
            fill="#FFFDF8"
            stroke="#7E4E2C"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Folded Top-Left Corner Flap */}
          <path
            d="M 188 148 L 218 144 L 218 115 Z"
            fill="#F6E5D3"
            stroke="#7E4E2C"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Fold Shadow Accent */}
          <path
            d="M 189 148 L 218 148 L 218 116"
            stroke="#E3CEB5"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Faint Horizontal Ruled Note Lines */}
          <path
            d="M 228 135 L 282 135"
            stroke="#FCE4D4"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 202 158 L 210 158"
            stroke="#FCE4D4"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 276 158 L 284 158"
            stroke="#FCE4D4"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 202 225 L 282 225"
            stroke="#FCE4D4"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 202 247 L 282 247"
            stroke="#FCE4D4"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* Arms */}
        <g id="character-arms">
          {/* Left Arm: akimbo on hip */}
          <path
            d="M 188 198 C 168 208 166 226 186 235"
            stroke="#7E4E2C"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Right Arm: raised, scratching head/temple */}
          <path
            d="M 296 195 C 316 182 318 152 292 140"
            stroke="#7E4E2C"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Hand touch on temple */}
          <circle cx="290" cy="140" r="3.5" fill="#7E4E2C" />
        </g>

        {/* Face */}
        <g id="character-face">
          {/* Worried Eyebrows */}
          <path
            d="M 215 171 Q 222 163 231 169"
            stroke="#302B27"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 267 169 Q 260 163 251 171"
            stroke="#302B27"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />

          {/* Expressive Eyes with Catchlight (blinking animation) */}
          <g id="character-eyes" className="anim-eyes">
            {/* Left Eye */}
            <ellipse cx="227" cy="184" rx="4.5" ry="7" fill="#302B27" />
            <circle cx="225.5" cy="181.5" r="1.8" fill="#FFFFFF" />

            {/* Right Eye */}
            <ellipse cx="257" cy="184" rx="4.5" ry="7" fill="#302B27" />
            <circle cx="255.5" cy="181.5" r="1.8" fill="#FFFFFF" />
          </g>

          {/* Soft Peach Blush */}
          <ellipse
            cx="214"
            cy="194"
            rx="7.5"
            ry="4.5"
            fill="#FFAAA6"
            opacity="0.8"
          />
          <ellipse
            cx="270"
            cy="194"
            rx="7.5"
            ry="4.5"
            fill="#FFAAA6"
            opacity="0.8"
          />

          {/* Small Worried Frown */}
          <path
            d="M 237 202 Q 242 196 247 202"
            stroke="#7E4E2C"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </g>

      {/* 6. Floating Tomato Red Question Mark & Action Ticks */}
      <g id="floating-marks" className="anim-marks">
        {/* Bold Question Mark */}
        <path
          d="M 284 76 C 284 64 306 62 306 76 C 306 85 297 87 297 94"
          stroke="#E6533D"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="296" cy="106" r="3.5" fill="#E6533D" />

        {/* Confusion Radiation Ticks */}
        <path
          d="M 314 74 L 324 67"
          stroke="#E6533D"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M 316 88 L 327 91"
          stroke="#E6533D"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
