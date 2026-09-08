import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 font-semibold">
          <img src="/gouyingai-mark.png" alt="" className="h-7 w-7 object-contain" />
          <span>{appName}</span>
        </span>
      ),
    },
    links: [
      {
        text: '文档导航',
        url: '/docs/overview/quick-start',
        on: 'nav',
      },
    ],
  };
}
