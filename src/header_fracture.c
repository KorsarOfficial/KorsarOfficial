#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#ifdef _WIN32
#include <io.h>
#include <fcntl.h>
#endif

#define W 854
#define H 220
#define FPS 20
#define FRAMES 232
#define SECTORS 18
#define MAX_PIECES 128
#define PI 3.14159265358979323846

typedef struct { double x,y; } Point;
typedef struct { Point p[12]; int n; double cx,cy,dist,start,spin; } Piece;
static Piece pieces[MAX_PIECES];
static int piece_count;
static unsigned char front[W*H*3],back[W*H*3],frame[W*H*3];
static unsigned int state=72519;
static double random01(void) { state=state*1664525u+1013904223u; return (double)(state>>8)/16777216.0; }
static double clamp(double x,double a,double b) { return x<a?a:x>b?b:x; }
static double smooth(double a,double b,double x) { x=clamp((x-a)/(b-a),0,1); return x*x*(3-2*x); }
static double boundary(Point p,int edge) { return edge==0?p.x:edge==1?W-p.x:edge==2?p.y:H-p.y; }
static void add_piece(Point *points,int count) {
    Point a[16],b[16]; int n=count;
    memcpy(a,points,(size_t)n*sizeof(Point));
    for(int e=0;e<4;e++) {
        int m=0;
        for(int i=0;i<n;i++) {
            Point s=a[i],t=a[(i+1)%n]; double ds=boundary(s,e),dt=boundary(t,e);
            if(ds>=0) b[m++]=s;
            if((ds>=0)!=(dt>=0)) { double u=ds/(ds-dt); b[m++]=(Point){s.x+(t.x-s.x)*u,s.y+(t.y-s.y)*u}; }
        }
        memcpy(a,b,(size_t)m*sizeof(Point)); n=m;
        if(n<3) return;
    }
    double area=0;
    for(int i=0;i<n;i++) area+=a[i].x*a[(i+1)%n].y-a[(i+1)%n].x*a[i].y;
    if(fabs(area)<8 || piece_count>=MAX_PIECES) return;
    Piece *p=&pieces[piece_count++]; p->n=n;
    memcpy(p->p,a,(size_t)n*sizeof(Point));
    for(int i=0;i<n;i++) { p->cx+=a[i].x/n; p->cy+=a[i].y/n; }
    p->dist=hypot((p->cx-558)/1.25,p->cy-102);
    p->start=p->dist<65?2.1+random01()*.45:3.5+p->dist*.0012+random01()*.3;
    p->spin=(random01()-.5)*2.8;
}
static void geometry(void) {
    const double radius[5]={0,43,94,210,850};
    Point ring[5][SECTORS];
    for(int r=0;r<5;r++) for(int k=0;k<SECTORS;k++) {
        double angle=k*2*PI/SECTORS+(r?((random01()-.5)*.16):0);
        double rad=radius[r]*(.78+random01()*.42);
        ring[r][k]=(Point){558+cos(angle)*rad*1.3,102+sin(angle)*rad};
    }
    for(int r=1;r<5;r++) for(int k=0;k<SECTORS;k++) {
        int j=(k+1)%SECTORS;
        if(r==1) { Point p[3]={{558,102},ring[r][k],ring[r][j]}; add_piece(p,3); }
        else {
            Point p[4]={ring[r-1][k],ring[r][k],ring[r][j],ring[r-1][j]};
            if(r==2 && k%3==0) { Point q[3]={p[0],p[1],p[2]},s[3]={p[0],p[2],p[3]}; add_piece(q,3); add_piece(s,3); }
            else add_piece(p,4);
        }
    }
}
static int inside(const Piece *p,double x,double y) {
    int yes=0;
    for(int i=0,j=p->n-1;i<p->n;j=i++) {
        Point a=p->p[i],b=p->p[j];
        if(((a.y>y)!=(b.y>y)) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) yes=!yes;
    }
    return yes;
}
static void line(Point a,Point b,double opacity) {
    int steps=(int)ceil(hypot(b.x-a.x,b.y-a.y)*1.5);
    if(steps<1) return;
    for(int s=0;s<=steps;s++) {
        double u=(double)s/steps; int x=(int)(a.x+(b.x-a.x)*u),y=(int)(a.y+(b.y-a.y)*u);
        if(x<0 || x>=W || y<0 || y>=H) continue;
        int i=(y*W+x)*3;
        const int c[3]={152,174,185};
        for(int k=0;k<3;k++) frame[i+k]=(unsigned char)(frame[i+k]*(1-opacity)+c[k]*opacity);
    }
}
static void draw_piece(const Piece *p,double time) {
    double dt=fmax(0,time-p->start),flight=dt*dt;
    if(dt>2.2) return;
    double vx=(p->cx-558)*.55,vy=(p->cy-102)*.65-65;
    double tx=vx*dt,ty=vy*dt+280*flight;
    double angle=p->spin*dt,c=cos(angle),s=sin(angle),sx=fmax(.2,fabs(cos(dt*1.9)));
    Point transformed[12]; double minx=W,miny=H,maxx=0,maxy=0;
    for(int i=0;i<p->n;i++) {
        double x=(p->p[i].x-p->cx)*sx,y=p->p[i].y-p->cy;
        transformed[i]=(Point){p->cx+c*x-s*y+tx,p->cy+s*x+c*y+ty};
        minx=fmin(minx,transformed[i].x);maxx=fmax(maxx,transformed[i].x);
        miny=fmin(miny,transformed[i].y);maxy=fmax(maxy,transformed[i].y);
    }
    int x0=(int)clamp(floor(minx),0,W),x1=(int)clamp(ceil(maxx),0,W);
    int y0=(int)clamp(floor(miny),0,H),y1=(int)clamp(ceil(maxy),0,H);
    for(int y=y0;y<y1;y++) for(int x=x0;x<x1;x++) {
        double dx=x+.5-p->cx-tx,dy=y+.5-p->cy-ty;
        double px=(c*dx+s*dy)/sx+p->cx,py=-s*dx+c*dy+p->cy;
        if(px<0 || px>=W || py<0 || py>=H || !inside(p,px,py)) continue;
        int src=((int)py*W+(int)px)*3,dst=(y*W+x)*3;
        double shade=1-.3*smooth(0,.8,dt);
        for(int k=0;k<3;k++) frame[dst+k]=(unsigned char)(front[src+k]*shade);
    }
    double crack=smooth(1.35+p->dist*.0014,1.65+p->dist*.0014,time)*.62;
    if(time<8.7) for(int i=0;i<p->n;i++) {
        if((p->p[i].x==0 && p->p[(i+1)%p->n].x==0) || (p->p[i].x==W && p->p[(i+1)%p->n].x==W)) continue;
        line(transformed[i],transformed[(i+1)%p->n],crack*(dt>0?1:.6));
    }
}
static int prepare(const char *path) {
    FILE *f=fopen(path,"wb"); if(!f) return 1;
    fprintf(f,"P6\n%d %d\n255\n",W,H);
    for(int y=0;y<H;y++) for(int x=0;x<W;x++) {
        double u=(double)x/W,wave1=160+17*sin(u*7),wave2=172+13*cos(u*5);
        const int bg[3]={13,17,23};
        double target[3]={13+13*u,17+10*u,23+16*u};
        for(int k=0;k<3;k++) {
            double value=bg[k];
            if(y<wave1) value=value*.6+target[k]*.4;
            if(y<wave2) value=value*.6+target[k]*.4;
            front[(y*W+x)*3+k]=(unsigned char)value;
        }
    }
    int ok=fwrite(front,1,sizeof(front),f)==sizeof(front); fclose(f); return ok?0:1;
}
int main(int argc,char **argv) {
    if(argc==3 && strcmp(argv[1],"--prepare")==0) return prepare(argv[2]);
    if(argc!=3) { fprintf(stderr,"Usage: fracture front.rgb back.rgb\n");return 1; }
    FILE *f=fopen(argv[1],"rb"),*b=fopen(argv[2],"rb");
    if(!f||!b) { fprintf(stderr,"Cannot open input\n");return 1; }
    if(fread(front,1,sizeof(front),f)!=sizeof(front)) return 1;
    fclose(f);geometry();
#ifdef _WIN32
    _setmode(_fileno(stdout),_O_BINARY);
#endif
    for(int n=0;n<FRAMES;n++) {
        double t=(double)n/FPS;
        double restore=1-smooth(9.6,11.0,t);
        double fracture_time=fmin(t,3.0)*restore;
        double flight_time=fmin(t,4.8)*restore;
        if(fread(back,1,sizeof(back),b)!=sizeof(back)) { fprintf(stderr,"Missing frame %d\n",n);return 1; }
        if(flight_time<1.35) memcpy(frame,front,sizeof(frame));
        else {
            memcpy(frame,back,sizeof(frame));
            for(int i=0;i<piece_count;i++)
                if(pieces[i].start>=3.0) draw_piece(&pieces[i],fracture_time);
            for(int i=0;i<piece_count;i++)
                if(pieces[i].start<3.0) draw_piece(&pieces[i],flight_time);
        }
        if(fwrite(frame,1,sizeof(frame),stdout)!=sizeof(frame)) return 1;
    }
    fclose(b); fprintf(stderr,"Rendered %d frames, %d shards\n",FRAMES,piece_count);return 0;
}
