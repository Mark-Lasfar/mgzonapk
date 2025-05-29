import { getNoCachedSetting } from '@/lib/actions/setting.actions'
import SettingForm from './setting-form'
import SettingNav from './setting-nav'
import PointsForm from './points-form'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Setting',
}

const SettingPage = async () => {
  const setting = await getNoCachedSetting()
  return (
    <div className="grid md:grid-cols-5 max-w-6xl mx-auto gap-4">
      <SettingNav />
      <main className="col-span-4 ">
        <div className="my-8">
          <SettingForm setting={setting} />
          <PointsForm setting={setting} />
        </div>
      </main>
    </div>
  )
}

export default SettingPage