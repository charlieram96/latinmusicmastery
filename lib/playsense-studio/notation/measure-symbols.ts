import {BarlineType, VoltaType, type Stave} from 'vexflow';
/** Shared authored signs, independent of selection and playback expansion. */
export function applyMeasureSymbols(stave:Stave, measure:{repeatStart?:boolean;repeatEnd?:boolean;volta?:'1.'|'2.'}) {
 if(measure.repeatStart)stave.setBegBarType(BarlineType.REPEAT_BEGIN);
 if(measure.repeatEnd)stave.setEndBarType(BarlineType.REPEAT_END);
 if(measure.volta)stave.setVoltaType(VoltaType.BEGIN_END,measure.volta,0);
}
