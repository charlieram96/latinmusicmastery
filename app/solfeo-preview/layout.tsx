import DashboardLayout from '@/app/dashboard/layout'
import { PreviewClientBoundary } from '@/components/solfeo/preview-client-boundary'

// Use the authenticated shared shell, with stable client IDs in local previews.
export default function SolfeoPreviewLayout({ children }: { children: React.ReactNode }) {
  return <PreviewClientBoundary><DashboardLayout>{children}</DashboardLayout></PreviewClientBoundary>
}
