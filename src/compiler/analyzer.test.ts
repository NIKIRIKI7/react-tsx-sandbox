import { describe, it, expect } from 'vitest';
import { extractBareImports } from './analyzer';

describe('compiler/analyzer.extractBareImports', () => {
  it('extracts a default import', () => {
    expect(extractBareImports(`import React from 'react';`)).toEqual(['react']);
  });

  it('extracts named imports', () => {
    expect(extractBareImports(`import { motion } from 'framer-motion';`)).toEqual([
      'framer-motion',
    ]);
  });

  it('extracts a namespace import', () => {
    expect(extractBareImports(`import * as THREE from 'three';`)).toEqual(['three']);
  });

  it('extracts a mixed default + named import', () => {
    expect(extractBareImports(`import React, { useState, useEffect } from "react";`)).toEqual([
      'react',
    ]);
  });

  it('extracts a side-effect only import', () => {
    expect(extractBareImports(`import 'swiper/css';`)).toEqual(['swiper/css']);
  });

  it('extracts type-only imports', () => {
    expect(extractBareImports(`import type { FC } from 'react';`)).toEqual(['react']);
  });

  it('handles scoped packages', () => {
    expect(extractBareImports(`import { thing } from '@scope/thing';`)).toEqual([
      '@scope/thing',
    ]);
  });

  it('handles package sub-paths', () => {
    expect(extractBareImports(`import get from 'lodash/fp/get';`)).toEqual(['lodash/fp/get']);
  });

  it('deduplicates repeated packages', () => {
    const code = `
      import React from 'react';
      import { useState } from "react";
      import { render } from 'react-dom';
    `;
    expect(extractBareImports(code).sort()).toEqual(['react', 'react-dom']);
  });

  it('ignores relative imports', () => {
    const code = `
      import './styles.css';
      import Component from '../components/Component';
      import util from './util';
    `;
    expect(extractBareImports(code)).toEqual([]);
  });

  it('ignores absolute path imports', () => {
    expect(extractBareImports(`import x from '/etc/passwd';`)).toEqual([]);
  });

  it('extracts multiple different packages from a real-world file', () => {
    const code = `
      import React from 'react';
      import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
      import { Cpu, Zap, Activity } from 'lucide-react';
    `;
    expect(extractBareImports(code).sort()).toEqual(['lucide-react', 'react', 'remotion']);
  });

  it('returns an empty array when there are no imports', () => {
    expect(extractBareImports(`export const Scene = () => null;`)).toEqual([]);
  });
});
