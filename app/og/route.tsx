import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* 品牌色装饰块 */}
        <div style={{
          position: 'absolute',
          top: 0, right: 0,
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(5,150,105,0.3) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />

        {/* Logo 图标 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '48px',
        }}>
          <div style={{
            width: '52px', height: '52px',
            background: '#059669',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 32 32">
              <polyline points="8,17 13,22 24,11" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <span style={{ color: '#ffffff', fontSize: '28px', fontWeight: '600' }}>OfferHelper</span>
        </div>

        {/* 主标题 */}
        <div style={{
          color: '#ffffff',
          fontSize: '56px',
          fontWeight: '700',
          lineHeight: '1.2',
          marginBottom: '24px',
          maxWidth: '800px',
        }}>
          把真实经历变成可投递的求职材料
        </div>

        {/* 副标题 */}
        <div style={{
          color: '#94a3b8',
          fontSize: '26px',
          marginBottom: '56px',
        }}>
          不编造，不包装，只优化表达
        </div>

        {/* 四个功能标签 */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {['简历优化', '岗位匹配', '面试训练', '优势挖掘'].map(label => (
            <div key={label} style={{
              background: 'rgba(5,150,105,0.2)',
              border: '1px solid rgba(5,150,105,0.5)',
              color: '#6ee7b7',
              padding: '8px 20px',
              borderRadius: '100px',
              fontSize: '20px',
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* 底部域名 */}
        <div style={{
          position: 'absolute',
          bottom: '48px', right: '80px',
          color: '#475569',
          fontSize: '20px',
        }}>
          offerhelper.cloud
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
