import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { companyLogoImage } from '../utils/nativeCompanyBranding';

// Size the image itself to its proportions, rather than placing it in a square.
export default function NativeCompanyLogo({url,label,height:targetHeight=44,maxWidth=104}) {
  const [failed,setFailed]=useState(false);
  const [ratio,setRatio]=useState(1);
  useEffect(()=>{setFailed(false);setRatio(1);},[url]);
  const source=!failed&&/^https?:\/\//.test(url||'')?{uri:url}:companyLogoImage();
  const width=Math.min(maxWidth,targetHeight*ratio),height=width/ratio;
  return <Image source={source} accessibilityLabel={label} resizeMode="stretch"
    onError={()=>setFailed(true)}
    onLoad={({nativeEvent})=>{
      const {width:w,height:h}=nativeEvent.source||{};
      if(w>0&&h>0)setRatio(w/h);
    }} style={{width,height}}/>;
}
