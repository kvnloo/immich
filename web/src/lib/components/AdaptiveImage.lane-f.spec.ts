import { fireEvent, render } from '@testing-library/svelte';
import type { AssetResponseDto } from '@immich/sdk';
import { tick } from 'svelte';
import AdaptiveImage from '$lib/components/AdaptiveImage.svelte';
import { assetViewerManager } from '$lib/managers/asset-viewer-manager.svelte';

vi.mock('$lib/utils/sw-messaging', () => ({
  cancelImageUrl: vi.fn(),
}));

const asset = (width: number, height: number): AssetResponseDto =>
  ({
    id: '00000000-0000-4000-8000-000000000001',
    type: 'IMAGE',
    width,
    height,
    thumbhash: null,
    originalFileName: 'lane-f-fixture.jpg',
    originalMimeType: 'image/jpeg',
    localDateTime: '2026-01-01T12:00:00.000Z',
    fileCreatedAt: '2026-01-01T12:00:00.000Z',
    createdAt: '2026-01-01T12:00:00.000Z',
  }) as AssetResponseDto;

const image = (base: HTMLElement, quality: string) =>
  base.querySelector<HTMLImageElement>(`img[data-testid="${quality}"]`);

afterEach(() => {
  assetViewerManager.resetZoomState();
});

describe('AdaptiveImage zoom promotion on the actual Svelte component', () => {
  for (const [width, height] of [
    [2500, 1750],
    [16384, 12288],
  ]) {
    it(`preserves preview on quick zoom-out (${width}x${height} metadata)`, async () => {
      assetViewerManager.resetZoomState();
      const rendered = render(AdaptiveImage, {
        asset: asset(width, height),
        container: { width: 900, height: 650 },
      });
      try {
        await tick();
        const thumbnail = image(rendered.baseElement, 'thumbnail');
        expect(thumbnail).not.toBeNull();

        // Zoom before the thumbnail finishes; this was the failing PR #6 path.
        assetViewerManager.zoom = 2;
        await tick();
        await fireEvent.load(thumbnail!);
        await tick();

        expect(image(rendered.baseElement, 'preview')).not.toBeNull();

        // Cancel pending original promotion and verify preview is still available.
        assetViewerManager.zoom = 1;
        await tick();
        await new Promise((resolve) => setTimeout(resolve, 230));
        await tick();
        expect(image(rendered.baseElement, 'preview')).not.toBeNull();
        expect(image(rendered.baseElement, 'original')).toBeNull();
      } finally {
        rendered.unmount();
      }
    });
  }

  it('promotes original after zoom settles without losing preview first', async () => {
    assetViewerManager.resetZoomState();
    const rendered = render(AdaptiveImage, {
      asset: asset(2500, 1750),
      container: { width: 900, height: 650 },
    });
    try {
      await tick();
      await fireEvent.load(image(rendered.baseElement, 'thumbnail')!);
      await tick();
      expect(image(rendered.baseElement, 'preview')).not.toBeNull();

      assetViewerManager.zoom = 2;
      await tick();
      expect(image(rendered.baseElement, 'original')).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 230));
      await tick();
      expect(image(rendered.baseElement, 'original')).not.toBeNull();
    } finally {
      rendered.unmount();
    }
  });
});
