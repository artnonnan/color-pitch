"use client";
import { useState } from "react";
import { Button, Card, cx } from "./ui";
import { t } from "@/i18n";

export interface LessonAction {
  label: string;
  play: () => unknown;
}
export interface LessonStep {
  title: string;
  body: string;
  actions?: LessonAction[];
}

/**
 * A short step-by-step lesson shown before an exercise: a title, a short explanation and
 * buttons that play examples. "เริ่มฝึก" on the last step calls onBegin.
 */
export function Lesson({ steps, onBegin }: { steps: LessonStep[]; onBegin: () => void }) {
  const [i, setI] = useState(0);
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  return (
    <div className="flex flex-1 flex-col gap-4" data-testid="lesson">
      <Card className="space-y-4 text-center">
        <div className="flex justify-center gap-1.5">
          {steps.map((_, j) => (
            <span key={j} className={cx("h-1.5 w-6 rounded-full", j <= i ? "bg-accent" : "bg-surface-2")} />
          ))}
        </div>
        <h2 className="text-2xl font-black" data-testid="lesson-title">
          {step.title}
        </h2>
        <p className="whitespace-pre-line leading-relaxed text-ink-2">{step.body}</p>
        {step.actions && step.actions.length > 0 && (
          <div className={cx("grid gap-2", step.actions.length > 1 && "grid-cols-2")}>
            {step.actions.map((a, j) => (
              <Button
                key={j}
                variant={step.actions!.length === 1 ? "primary" : "secondary"}
                big={step.actions!.length === 1}
                onClick={() => void a.play()}
                data-testid={`lesson-action-${j}`}
              >
                ▶ {a.label}
              </Button>
            ))}
          </div>
        )}
      </Card>
      <div className="mt-auto grid grid-cols-2 gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button variant="secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
          ‹ {t.progressions.lesson.back}
        </Button>
        {last ? (
          <Button onClick={onBegin} data-testid="lesson-begin">
            {t.progressions.lesson.begin} ▶
          </Button>
        ) : (
          <Button onClick={() => setI(i + 1)} data-testid="lesson-next">
            {t.progressions.lesson.next} ›
          </Button>
        )}
      </div>
    </div>
  );
}
