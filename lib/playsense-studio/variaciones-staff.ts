import type { PercussionStaffCue, PercussionStroke } from './percussion-staff'

// Exact local upload clock. 32 bars: Sobao / shell fill / Sobao / shell fill.
// Shell-hand distribution follows the authored Relleno Mano Izquierda pattern.
// Attack times refined from the waveform; camera cuts checked for top-left placement.
type Hit = readonly [number, PercussionStroke | null, PercussionStroke | null]
function bar(start:number,end:number,bar:number,section:'sobao'|'cascara',call:boolean,hits:readonly Hit[]): PercussionStaffCue {
  return {start,end,bar,section,call,position:{x:12,y:12},slots:hits.map(([at,right,left])=>({at,right:right === 'tom' ? 'rim' : right,left:left === 'cascara' ? 'cascara-low' : left}))}
}
export const variacionesStaff: readonly PercussionStaffCue[] = [
  bar(297.384,299.799,1,'sobao',false,[[297.384,"cascara",null],[297.696,null,"muted"],[298.001,"cascara",null],[298.3,null,"muted"],[298.599,"cascara",null],[298.904,"cascara",null],[299.203,null,"open"],[299.477,"cascara",null]]),
  bar(299.799,302.183,2,'sobao',false,[[299.799,"cascara",null],[300.097,null,null],[300.38,"cascara","muted"],[300.695,"cascara",null],[301.014,null,"muted"],[301.283,"cascara",null],[301.593,null,"open"],[301.862,"cascara",null]]),
  bar(302.183,304.593,1,'sobao',false,[[302.183,"cascara",null],[302.484,null,null],[302.76,"cascara","muted"],[303.087,null,null],[303.383,"cascara",null],[303.688,"cascara",null],[304.022,null,"open"],[304.276,"cascara",null]]),
  bar(304.593,306.977,2,'sobao',false,[[304.593,"cascara",null],[304.891,null,null],[305.189,"cascara","muted"],[305.494,"cascara",null],[305.793,null,"muted"],[306.067,"cascara",null],[306.362,null,"open"],[306.661,"cascara",null]]),
  bar(306.977,309.392,1,'sobao',false,[[306.977,"cascara",null],[307.279,null,null],[307.579,"cascara","muted"],[307.883,null,null],[308.193,"cascara",null],[308.497,"cascara",null],[308.806,null,"open"],[309.081,"cascara",null]]),
  bar(309.392,311.776,2,'sobao',false,[[309.392,"cascara",null],[309.69,null,null],[309.983,"cascara","muted"],[310.293,"cascara",null],[310.597,null,"muted"],[310.881,"cascara",null],[311.181,null,"open"],[311.475,"cascara",null]]),
  bar(311.776,314.181,1,'sobao',false,[[311.776,"cascara",null],[312.094,null,null],[312.373,"cascara","muted"],[312.712,null,null],[312.977,"cascara",null],[313.286,"cascara",null],[313.595,null,"open"],[313.875,"cascara",null]]),
  bar(314.181,316.595,2,'sobao',true,[[314.181,"cascara",null],[314.483,null,null],[314.758,"cascara","muted"],[315.082,"cascara",null],[315.406,null,"muted"],[315.686,"tom",null],[315.985,null,"tom"],[316.293,null,null]]),
  bar(316.595,318.98,1,'cascara',false,[[316.595,"cascara",null],[316.878,null,"cascara"],[317.167,"cascara",null],[317.486,null,"cascara"],[317.771,"cascara",null],[318.08,"cascara",null],[318.374,null,"cascara"],[318.654,"cascara",null]]),
  bar(318.98,321.424,2,'cascara',false,[[318.98,"cascara",null],[319.272,null,"cascara"],[319.587,"cascara",null],[319.886,"cascara",null],[320.19,null,"cascara"],[320.51,"cascara",null],[320.794,null,"cascara"],[321.103,"cascara",null]]),
  bar(321.424,323.789,1,'cascara',false,[[321.424,"cascara",null],[321.697,null,"cascara"],[321.991,"cascara",null],[322.295,null,"cascara"],[322.585,"cascara",null],[322.884,"cascara",null],[323.168,null,"cascara"],[323.473,"cascara",null]]),
  bar(323.789,326.194,2,'cascara',false,[[323.789,"cascara",null],[324.086,null,"cascara"],[324.391,"cascara",null],[324.695,"cascara",null],[324.989,null,"cascara"],[325.294,"cascara",null],[325.583,null,"cascara"],[325.882,"cascara",null]]),
  bar(326.194,328.598,1,'cascara',false,[[326.194,"cascara",null],[326.481,null,"cascara"],[326.775,"cascara",null],[327.085,null,"cascara"],[327.389,"cascara",null],[327.688,"cascara",null],[327.983,null,"cascara"],[328.272,"cascara",null]]),
  bar(328.598,330.998,2,'cascara',false,[[328.598,"cascara",null],[328.881,null,"cascara"],[329.17,"cascara",null],[329.484,"cascara",null],[329.793,null,"cascara"],[330.088,"cascara",null],[330.377,null,"cascara"],[330.681,"cascara",null]]),
  bar(330.998,333.387,1,'cascara',false,[[330.998,"cascara",null],[331.275,null,"cascara"],[331.584,"cascara",null],[331.884,null,"cascara"],[332.178,"cascara",null],[332.482,"cascara",null],[332.787,null,"cascara"],[333.066,"cascara",null]]),
  bar(333.387,335.797,2,'cascara',true,[[333.387,"cascara",null],[333.66,null,"cascara"],[333.954,"cascara",null],[334.258,"cascara",null],[334.563,null,"cascara"],[334.842,"tom",null],[335.161,null,"tom"],[335.496,null,null]]),
  bar(335.797,338.211,1,'sobao',false,[[335.797,"cascara",null],[336.099,null,null],[336.383,"cascara","muted"],[336.723,null,null],[336.962,"cascara",null],[337.291,"cascara",null],[337.616,null,"open"],[337.9,"cascara",null]]),
  bar(338.211,340.596,2,'sobao',false,[[338.211,"cascara",null],[338.509,null,null],[338.798,"cascara","muted"],[339.117,"cascara",null],[339.412,null,"muted"],[339.696,"cascara",null],[339.985,null,"open"],[340.295,"cascara",null]]),
  bar(340.596,342.99,1,'sobao',false,[[340.596,"cascara",null],[340.895,null,null],[341.188,"cascara","muted"],[341.494,null,null],[341.781,"cascara",null],[342.081,"cascara",null],[342.38,null,"open"],[342.679,"cascara",null]]),
  bar(342.99,345.4,2,'sobao',false,[[342.99,"cascara",null],[343.291,null,null],[343.592,"cascara","muted"],[343.911,"cascara",null],[344.216,null,"muted"],[344.5,"cascara",null],[344.789,null,"open"],[345.064,"cascara",null]]),
  bar(345.4,347.805,1,'sobao',false,[[345.4,"cascara",null],[345.701,null,null],[345.977,"cascara","muted"],[346.302,null,null],[346.575,"cascara",null],[346.89,"cascara",null],[347.199,null,"open"],[347.488,"cascara",null]]),
  bar(347.805,350.184,2,'sobao',false,[[347.805,"cascara",null],[348.102,null,null],[348.381,"cascara","muted"],[348.69,"cascara",null],[348.99,null,"muted"],[349.274,"cascara",null],[349.578,null,"open"],[349.878,"cascara",null]]),
  bar(350.184,352.584,1,'sobao',false,[[350.184,"cascara",null],[350.484,null,null],[350.756,"cascara","muted"],[351.084,null,null],[351.379,"cascara",null],[351.674,"cascara",null],[351.988,null,"open"],[352.282,"cascara",null]]),
  bar(352.584,354.983,2,'sobao',true,[[352.584,"cascara",null],[352.884,null,null],[353.175,"cascara","muted"],[353.475,"cascara",null],[353.784,null,"muted"],[354.068,"tom",null],[354.368,null,"tom"],[354.683,"rim",null]]),
  bar(354.983,357.363,1,'cascara',false,[[354.983,"cascara",null],[355.266,null,"cascara"],[355.555,"cascara",null],[355.849,null,"cascara"],[356.149,"cascara",null],[356.453,"cascara",null],[356.747,null,"cascara"],[357.042,"cascara",null]]),
  bar(357.363,359.787,2,'cascara',false,[[357.363,"cascara",null],[357.66,null,"cascara"],[357.964,"cascara",null],[358.259,"cascara",null],[358.578,null,"cascara"],[358.877,"cascara",null],[359.167,null,"cascara"],[359.471,"cascara",null]]),
  bar(359.787,362.182,1,'cascara',false,[[359.787,"cascara",null],[360.09,null,"cascara"],[360.374,"cascara",null],[360.693,null,"cascara"],[360.998,"cascara",null],[361.287,"cascara",null],[361.576,null,"cascara"],[361.876,"cascara",null]]),
  bar(362.182,364.591,2,'cascara',false,[[362.182,"cascara",null],[362.474,null,"cascara"],[362.773,"cascara",null],[363.073,"cascara",null],[363.367,null,"cascara"],[363.656,"cascara",null],[363.971,null,"cascara"],[364.265,"cascara",null]]),
  bar(364.591,367.001,1,'cascara',false,[[364.591,"cascara",null],[364.874,null,"cascara"],[365.173,"cascara",null],[365.492,null,"cascara"],[365.797,"cascara",null],[366.091,"cascara",null],[366.385,null,"cascara"],[366.69,"cascara",null]]),
  bar(367.001,369.405,2,'cascara',false,[[367.001,"cascara",null],[367.288,null,"cascara"],[367.583,"cascara",null],[367.882,"cascara",null],[368.181,null,"cascara"],[368.49,"cascara",null],[368.79,null,"cascara"],[369.089,"cascara",null]]),
  bar(369.405,371.8,1,'cascara',false,[[369.405,"cascara",null],[369.698,null,"cascara"],[369.997,"cascara",null],[370.306,null,"cascara"],[370.596,"cascara",null],[370.905,"cascara",null],[371.199,null,"cascara"],[371.489,"cascara",null]]),
  bar(371.8,374.2,2,'cascara',false,[[371.8,"cascara",null],[372.097,null,"cascara"],[372.397,"cascara",null],[372.701,"cascara",null],[373.005,null,"cascara"],[373.29,"cascara",null],[373.589,null,"cascara"],[373.893,"cascara",null]]),
  // Instructor-confirmed final right-hand quarter, after the 32-bar sequence.
  { start:374.2,end:374.84,bar:1,section:'cascara',closing:true,position:{x:12,y:12},
    slots:[{at:374.222,right:'cascara',left:null}] },
]
