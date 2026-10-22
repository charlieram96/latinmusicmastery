import { KidsLocalCoursePage } from '@/components/solfeo-kids/local-course-page'
export default function Page({searchParams}:{searchParams:Promise<{class?:string;module?:string}>}) {return <KidsLocalCoursePage searchParams={searchParams} editor/>}
