import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/** Procedural Rasch probability surface; visual only, never used for scoring. */
export function RaschSurface() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(8, 8, 12);
    camera.lookAt(0, 0, 0);
    const group = new THREE.Group();
    scene.add(group);
    const styles = getComputedStyle(element);
    const color = (name: string) => new THREE.Color(styles.getPropertyValue(name).trim());
    const geometry = new THREE.PlaneGeometry(12, 9, 52, 38);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const difficulty = positions.getY(i);
      positions.setXYZ(i, x, 4 / (1 + Math.exp(-(x - difficulty) * 0.7)) - 2, difficulty);
    }
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({ color: color('--surface-turquoise'), wireframe: true, transparent: true, opacity: 0.36 });
    group.add(new THREE.Mesh(geometry, material));
    const pointMaterial = new THREE.PointsMaterial({ color: color('--surface-gold'), size: 0.045, transparent: true, opacity: 0.8 });
    group.add(new THREE.Points(geometry, pointMaterial));
    group.rotation.z = -0.1;
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const pointer = { x: 0, y: 0 };
    const move = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / rect.width - 0.5;
      pointer.y = (event.clientY - rect.top) / rect.height - 0.5;
    };
    element.parentElement?.addEventListener('pointermove', move);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const draw = (time: number) => {
      if (!reduced) {
        group.rotation.y = Math.sin(time * 0.00015) * 0.12 + pointer.x * 0.16;
        group.rotation.x = pointer.y * 0.08;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.parentElement?.removeEventListener('pointermove', move);
      geometry.dispose();
      material.dispose();
      pointMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="rasch-stage" aria-hidden="true" />;
}