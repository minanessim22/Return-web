"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

// Exact filenames from the uploaded image
const letterImages = {
  R: "/photos/R.png",     // Capital R for first letter
  E: "/photos/e.png",     // Lowercase e
  T: "/photos/t.png",     // Lowercase t
  U: "/photos/u.png",     // Lowercase u
  R2: "/photos/r .png",   // Lowercase r for second R (note the space)
  N: "/photos/n.png"      // Lowercase n
};

const RETURN_SEQUENCE = [
  { letter: "R", imageKey: "R" },
  { letter: "E", imageKey: "E" },
  { letter: "T", imageKey: "T" },
  { letter: "U", imageKey: "U" },
  { letter: "R", imageKey: "R2" },
  { letter: "N", imageKey: "N" }
] as const;

type AnimationPhase = "initial" | "large-r" | "word-assembly" | "zoom-in" | "complete";

export function SplashSequence() {
  const [currentPhase, setCurrentPhase] = useState<AnimationPhase>("initial");
  const [visibleLetterIndex, setVisibleLetterIndex] = useState<number>(0);
  const router = useRouter();

  useEffect(() => {
    const animationSequence = async () => {
      // Phase 1: Initial delay and show large R
      await new Promise(resolve => setTimeout(resolve, 400));
      setCurrentPhase("large-r");

      // Phase 2: Hold large R for visual impact
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Phase 3: Begin word assembly - transition R and show other letters
      setCurrentPhase("word-assembly");

      // Stagger the appearance of remaining letters
      for (let i = 1; i <= RETURN_SEQUENCE.length; i++) {
        setVisibleLetterIndex(i);
        await new Promise(resolve => setTimeout(resolve, 180));
      }

      // Phase 4: Brief pause then zoom in
      await new Promise(resolve => setTimeout(resolve, 600));
      setCurrentPhase("zoom-in");

      // Phase 5: Complete zoom and redirect
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCurrentPhase("complete");

      // Navigate to guest homepage
      setTimeout(() => {
        router.push("/guest-homepage");
      }, 200);
    };

    animationSequence();
  }, [router]);

  return (
    <div className="fixed inset-0 bg-white overflow-hidden">
      <LayoutGroup>
        <div className="w-full h-full flex items-center justify-center">

          {/* Phase 1 & 2: Large centered R */}
          {(currentPhase === "large-r") && (
            <motion.div
              layoutId="first-r"
              className="flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.8,
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
            >
              <Image
                src={letterImages.R}
                alt="R"
                width={600}
                height={600}
                className="w-[35vw] h-[35vw] max-w-[320px] max-h-[320px] min-w-[200px] min-h-[200px] object-contain"
                priority
              />
            </motion.div>
          )}

          {/* Phase 3 & 4: Complete word formation with layout animations */}
          {(currentPhase === "word-assembly" || currentPhase === "zoom-in" || currentPhase === "complete") && (
            <motion.div
              className="flex items-center justify-center"
              style={{ gap: "0.8vw" }}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                scale: currentPhase === "zoom-in" || currentPhase === "complete" ? 2.5 : 1
              }}
              transition={{
                opacity: { duration: 0.3 },
                scale: {
                  duration: currentPhase === "zoom-in" || currentPhase === "complete" ? 1.2 : 0,
                  ease: [0.25, 0.46, 0.45, 0.94]
                }
              }}
            >
              {RETURN_SEQUENCE.map((letterData, index) => {
                const isVisible = index < visibleLetterIndex;
                const isFirstR = index === 0;
                const imageSrc = letterImages[letterData.imageKey as keyof typeof letterImages];

                return (
                  <motion.div
                    key={`${letterData.letter}-${index}`}
                    layoutId={isFirstR ? "first-r" : undefined}
                    className="flex-shrink-0"
                    initial={isFirstR ? false : {
                      opacity: 0,
                      y: 30,
                      scale: 0.7,
                      x: 100
                    }}
                    animate={
                      isVisible
                        ? {
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            x: 0
                          }
                        : {
                            opacity: 0,
                            y: 30,
                            scale: 0.7,
                            x: 100
                          }
                    }
                    transition={
                      isFirstR
                        ? {
                            type: "spring",
                            stiffness: 200,
                            damping: 25,
                            duration: 0.8
                          }
                        : {
                            duration: 0.5,
                            ease: [0.25, 0.46, 0.45, 0.94],
                            delay: isVisible ? 0 : 0
                          }
                    }
                  >
                    <Image
                      src={imageSrc}
                      alt={letterData.letter}
                      width={200}
                      height={200}
                      className="w-[7vw] h-[7vw] max-w-[85px] max-h-[85px] min-w-[50px] min-h-[50px] md:w-[6vw] md:h-[6vw] md:max-w-[100px] md:max-h-[100px] lg:w-[5vw] lg:h-[5vw] lg:max-w-[120px] lg:max-h-[120px] object-contain"
                      priority={index < 3}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Zoom effect overlay for immersion */}
          {(currentPhase === "zoom-in" || currentPhase === "complete") && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.1 }}
              transition={{ duration: 0.8 }}
              style={{
                background: "radial-gradient(circle at center, rgba(1,76,179,0.05) 0%, rgba(96,193,15,0.03) 100%)"
              }}
            />
          )}

        </div>
      </LayoutGroup>

      {/* Loading indicator for initial phase */}
      {currentPhase === "initial" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.4, 1, 0.4]
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-3 h-3 bg-gray-400 rounded-full"
          />
        </div>
      )}
    </div>
  );
}