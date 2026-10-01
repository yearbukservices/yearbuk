import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PrivacyPolicyDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const sections: { title: string; body: string }[] = [
  {
    title: "1. Information We Collect",
    body: "When you create an account we collect your name, email address, and the school or organization you belong to. When you upload memories, we collect the photos, captions, and other content you submit, along with basic technical information such as your device type and how you use the app.",
  },
  {
    title: "2. How We Use Your Information",
    body: "We use your information to operate Yearbuk, build and deliver your school's yearbook, keep uploaded content safe through review and moderation, communicate with you about your account, and improve the product. We do not sell your personal information.",
  },
  {
    title: "3. Photos and Memories",
    body: "Photos and memories you upload are shared with your school community according to the access settings your school's organizers choose. You can delete your own uploads at any time, and you can ask us to remove any content that includes you.",
  },
  {
    title: "4. How We Share Information",
    body: "We share information only with service providers that help us run Yearbuk, such as hosting and email delivery providers, and only as needed to provide the service. We may also share information if required by law.",
  },
  {
    title: "5. Student and Child Privacy",
    body: "Yearbuk may contain photos of minors submitted by schools or their organizers. Schools and organizers are responsible for obtaining any permissions needed before submitting content. If you are a parent or guardian and want content that includes your child removed, contact us or your school's yearbook administrator.",
  },
  {
    title: "6. Data Storage and Security",
    body: "Your data is stored securely using industry-standard practices, including encryption in transit. No method of storage or transmission is completely secure, but we work hard to protect your information.",
  },
  {
    title: "7. Data Retention",
    body: "We keep your information for as long as your account is active or as needed to provide the service. When your account is deleted or you ask us to remove your data, we delete or anonymize it except where we must keep it for legal reasons.",
  },
  {
    title: "8. Your Rights",
    body: "You can access, correct, or delete your personal information at any time from your account settings, or by contacting us. You may also object to or restrict certain processing of your data.",
  },
  {
    title: "9. Changes to This Policy",
    body: "We may update this policy from time to time. When we make significant changes, we will notify you in the app or by email.",
  },
  {
    title: "10. Contact Us",
    body: "If you have questions about this policy or want to exercise your rights, contact us through the app or reach out to your school's yearbook administrator.",
  },
];

export function PrivacyPolicyDialog({ open, onOpenChange }: PrivacyPolicyDialogProps) {
  return (
    <Dialog open={open ?? false} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Privacy Policy</DialogTitle>
          <DialogDescription>
            How Yearbuk collects, uses, and protects your information.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="space-y-4 text-sm leading-relaxed">
            <p className="text-muted-foreground">Last updated: October 2026</p>
            {sections.map((section) => (
              <div key={section.title}>
                <h3 className="font-semibold mb-1">{section.title}</h3>
                <p className="text-muted-foreground whitespace-pre-line">{section.body}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
