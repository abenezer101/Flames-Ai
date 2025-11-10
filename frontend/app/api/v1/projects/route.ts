import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Call the backend API
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';

    const response = await fetch(`${backendUrl}/api/v1/projects`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Backend error' }));
      return NextResponse.json(
        errorData,
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { message: 'Failed to fetch projects', error: String(error), projects: [] },
      { status: 500 }
    );
  }
}
