// hooks/use-setting.ts

import useSettingStore from './use-setting-store'

const useSetting = () => {
  const setting = useSettingStore((state) => state.setting)
  const setSetting = useSettingStore((state) => state.setSetting)
  const getCurrency = useSettingStore((state) => state.getCurrency)
  const setCurrency = useSettingStore((state) => state.setCurrency)

  return {
    setting,
    setSetting,
    getCurrency,
    setCurrency,
  }
}

export default useSetting
