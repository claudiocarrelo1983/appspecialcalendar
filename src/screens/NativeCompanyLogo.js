import React, { useState } from 'react';
import { Image, View } from 'react-native';
import { companyLogoImage } from '../utils/nativeCompanyBranding';

// Size the image itself to its proportions, rather than placing it in a square.
export default function NativeCompanyLogo({url,label,height:targetHeight=44,maxWidth=104}) {
  const [remote,setRemote]=useState(null);
  const [failedUrl,setFailedUrl]=useState(null);
  const loaded=!!remote&&remote.url===url&&failedUrl!==url;
  const local=companyLogoImage();
  const asset=Image.resolveAssetSource?.(local);
  const ratio=loaded?remote.ratio:asset?.width>0&&asset?.height>0?asset.width/asset.height:1;
  const width=Math.min(maxWidth,targetHeight*ratio),height=width/ratio;
  return <View accessibilityLabel={label} accessible style={{width,height}}>
    <Image source={local} resizeMode="contain" style={{width,height,opacity:loaded?0:1}}/>
    {/^https?:\/\//.test(url||'')&&failedUrl!==url&&<Image key={url} source={{uri:url}} resizeMode="contain"
    onError={()=>setFailedUrl(url)}
    onLoad={({nativeEvent})=>{
      const {width:w,height:h}=nativeEvent.source||{};
      if(Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0)setRemote({url,ratio:w/h});
    }} style={{position:'absolute',top:0,left:0,width,height,opacity:loaded?1:0}}/>}
  </View>;
}
