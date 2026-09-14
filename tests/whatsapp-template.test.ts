import { describe, it, expect } from 'vitest';
import { buildVariables } from '../supabase/functions/_shared/acs-template';

const item = {kind:'deadline',reference:'ACS-1',title:'Policy review',instruction:'Improve the "access" policy \\ draft\nKeep all provisions.',department_name:'Social Welfare',deadline:'2026-09-22',effective_date:null,time:null,venue:null,label:'Update due'};
describe('ACS WhatsApp template', () => {
  it('uses saved full instruction and deadline with JSON-safe punctuation', () => {
    const v=JSON.parse(buildVariables([item]));
    expect(v['1']).toContain('Improve the "access" policy \\ draft Keep all provisions.');
    expect(v['2']).toContain('Social Welfare');
    expect(v['3']).toContain('22 Sept 2026');
    expect(v['4']).toContain('Update due');
  });
  it('uses effective meeting date and Pakistan time, not task deadline', () => {
    const v=JSON.parse(buildVariables([{...item,kind:'meeting',effective_date:'2026-09-28',time:'10:00',venue:'Committee room',label:'Meeting scheduled'}]));
    expect(v['3']).toContain('28 Sept 2026 at 10:00 PKT');
    expect(v['3']).not.toContain('22 Sep');
    expect(v['4']).toContain('Committee room');
  });
  it('keeps every item in a combined recipient message', () => {
    const v=JSON.parse(buildVariables([item,{...item,reference:'ACS-2',instruction:'Second instruction'}]));
    expect(v['1']).toContain('Second instruction');
    expect(v['3']).toContain('2)');
  });
  it('rejects oversized content instead of silently cutting instructions', () => {
    expect(()=>buildVariables([{...item,instruction:'x'.repeat(2000)}])).toThrow('too long');
  });
  it('rejects missing items and invalid dates', () => {
    expect(()=>buildVariables([])).toThrow();
    expect(()=>buildVariables([{...item,deadline:'2026-02-30'}])).toThrow();
  });
});
