import React from 'react'
import { Body, Container, Head, Html, Preview, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  subject?: string
  body?: string
  preheader?: string
}

const Email = ({ body, preheader }: Props) => {
  const safeBody = body ?? ''
  const paragraphs = safeBody.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preheader ?? safeBody.slice(0, 120)}</Preview>
      <Body style={main}>
        <Container style={container}>
          {paragraphs.map((para, idx) => (
            <Text key={idx} style={text}>
              {para.split('\n').map((line, lineIdx, arr) => (
                <React.Fragment key={lineIdx}>
                  {line}
                  {lineIdx < arr.length - 1 ? <br /> : null}
                </React.Fragment>
              ))}
            </Text>
          ))}
          <Hr style={hr} />
          <Text style={footer}>Sent via MatchAI on behalf of the creator.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => (data?.subject as string) || 'Partnership opportunity',
  displayName: 'Brand outreach',
  previewData: {
    subject: 'Quick partnership idea',
    body: "Hey there,\n\nLoved your latest launch — I think there's a really natural fit between our audiences. Would love to share a quick concept.\n\nBest,\nCreator",
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const text = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#111111',
  margin: '0 0 16px',
}
const hr = { borderColor: '#eeeeee', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#999999', margin: 0 }
