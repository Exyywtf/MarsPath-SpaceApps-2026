import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { sampleGrid, scientificLayers, type ClimateData } from '../../lib/layers';
const climate:ClimateData=JSON.parse(readFileSync('public/processed/mcd-v62.json','utf8'));
it('reconstructs the provider node positions without a half-pixel shift',()=>{
  // Golden value from the original ASCII: longitude -180, latitude -90.
  expect(sampleGrid(climate.fields.temperature.values,64,48,[-180,-90],true)).toBeCloseTo(143.805,5);
  expect(sampleGrid(climate.fields.temperature.values,64,48,[180,-90],true)).toBeCloseTo(143.805,5);
  for(const field of Object.values(climate.fields)){
    expect(field.values).toHaveLength(64*48);
    expect(Math.min(...field.values)).toBeCloseTo(field.range[0],5);expect(Math.max(...field.values)).toBeCloseTo(field.range[1],5);
    expect(sampleGrid(field.values,64,48,[179.999,0],true)).toBeCloseTo(sampleGrid(field.values,64,48,[-180.001,0],true)!,6);
  }
});
it('uses bilinear numerical interpolation and blocks invalid neighbours',()=>{
  expect(sampleGrid([0,10,20,30],2,2,[0,0],true)).toBe(15);
  expect(sampleGrid([0,10,20,NaN],2,2,[0,0],true)).toBeNull();
  expect(sampleGrid([0,10,20,30],2,2,[0,91],true)).toBeNull();
});
it('has traceable metadata and native versus derived sampling for all four fields',()=>{
  expect(scientificLayers).toHaveLength(4);
  for(const layer of scientificLayers){expect(layer.sha256).toMatch(/^[a-f0-9]{64}$/);expect(layer.palette).toHaveLength(5);expect(layer.imageSize[0]/layer.imageSize[1]).toBe(2);expect(layer.sourcePage).toMatch(/^https:/);}
  expect(scientificLayers.find(l=>l.id==='topography')?.sampling).toContain('0.25');
});
