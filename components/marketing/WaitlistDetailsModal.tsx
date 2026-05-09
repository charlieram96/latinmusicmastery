"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { joinWaitlist } from "@/app/actions/waitlist"
import { useTranslation } from "@/components/language-provider"
import { cn } from "@/lib/utils"

type Option = { id: string; name: string }
type ExpertiseLevel = "beginner" | "intermediate" | "advanced"

interface WaitlistDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  instruments: Option[]
  styles: Option[]
  onSuccess: () => void
}

export function WaitlistDetailsModal({
  open,
  onOpenChange,
  email,
  instruments,
  styles,
  onSuccess,
}: WaitlistDetailsModalProps) {
  const { t } = useTranslation()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedInstruments, setSelectedInstruments] = useState<Set<string>>(
    new Set()
  )
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set())
  const [level, setLevel] = useState<ExpertiseLevel | "">("")

  const toggle = (
    set: Set<string>,
    setter: (s: Set<string>) => void,
    id: string
  ) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  const submit = (includeSelections: boolean) => {
    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append("email", email)
      if (includeSelections) {
        for (const id of selectedInstruments) {
          formData.append("instrument_ids", id)
        }
        for (const id of selectedStyles) {
          formData.append("style_ids", id)
        }
        if (level) formData.append("expertise_level", level)
      }
      const res = await joinWaitlist(formData)
      if (res.error) {
        setError(res.error)
        return
      }
      onSuccess()
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("homepage.waitlistForm.modal.title")}</DialogTitle>
          <DialogDescription>
            {t("homepage.waitlistForm.modal.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-foreground">
              {t("homepage.waitlistForm.modal.instrumentsLabel")}
            </legend>
            {instruments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("homepage.waitlistForm.modal.noOptions")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {instruments.map((opt) => {
                  const checked = selectedInstruments.has(opt.id)
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent",
                        checked && "border-primary bg-primary/5"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          toggle(
                            selectedInstruments,
                            setSelectedInstruments,
                            opt.id
                          )
                        }
                      />
                      <span className="leading-tight">{opt.name.trim()}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-foreground">
              {t("homepage.waitlistForm.modal.genresLabel")}
            </legend>
            {styles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("homepage.waitlistForm.modal.noOptions")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {styles.map((opt) => {
                  const checked = selectedStyles.has(opt.id)
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent",
                        checked && "border-primary bg-primary/5"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          toggle(selectedStyles, setSelectedStyles, opt.id)
                        }
                      />
                      <span className="leading-tight">{opt.name}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-semibold text-foreground">
              {t("homepage.waitlistForm.modal.expertiseLabel")}
            </legend>
            <RadioGroup
              value={level}
              onValueChange={(v) => setLevel(v as ExpertiseLevel)}
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {(["beginner", "intermediate", "advanced"] as const).map(
                (value) => (
                  <Label
                    key={value}
                    htmlFor={`expertise-${value}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent",
                      level === value && "border-primary bg-primary/5"
                    )}
                  >
                    <RadioGroupItem id={`expertise-${value}`} value={value} />
                    <span>
                      {t(`homepage.waitlistForm.modal.expertise.${value}`)}
                    </span>
                  </Label>
                )
              )}
            </RadioGroup>
          </fieldset>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => submit(false)}
            disabled={isPending}
          >
            {t("homepage.waitlistForm.modal.skip")}
          </Button>
          <Button
            type="button"
            onClick={() => submit(true)}
            disabled={isPending}
          >
            {isPending
              ? t("homepage.waitlistForm.joining")
              : t("homepage.waitlistForm.modal.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
