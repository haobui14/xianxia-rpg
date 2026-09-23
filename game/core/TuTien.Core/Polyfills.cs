// Lets C# 9 records and init-only setters compile on netstandard2.1, which keeps
// this library portable to Unity 6 as well as Godot 4.
namespace System.Runtime.CompilerServices
{
    internal static class IsExternalInit
    {
    }
}
