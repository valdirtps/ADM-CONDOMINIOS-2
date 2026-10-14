import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    cookieStore.set('session', '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });

    const response = NextResponse.json({ success: true });
    response.cookies.delete('session');
    response.cookies.set('session', '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });

    return response;
  } catch (error) {
    console.error('Logout API error:', error);
    const fallbackResponse = NextResponse.json({ success: true });
    fallbackResponse.cookies.set('session', '', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    return fallbackResponse;
  }
}
